/**
 * EquilateralAgents GitHub Action
 *
 * Copyright (c) 2025 HappyHippo.ai
 * Licensed under Apache-2.0
 *
 * GitHub Action wrapper for EquilateralAgents Open Core
 */

const core = require('@actions/core');
const github = require('@actions/github');
const { AgentOrchestrator } = require('equilateral-agents-open-core');

/**
 * Main action entry point
 */
async function run() {
    try {
        // Get inputs
        const workflowType = core.getInput('workflow-type');
        const projectPath = core.getInput('project-path');
        const llmProvider = core.getInput('llm-provider');
        const aiEnabled = core.getInput('ai-enabled') === 'true';
        const token = core.getInput('github-token');
        const createPRComment = core.getInput('create-pr-comment') === 'true';
        const createCheckRun = core.getInput('create-check-run') === 'true';
        const failOnErrors = core.getInput('fail-on-errors') === 'true';

        const octokit = github.getOctokit(token);
        const context = github.context;

        // Log configuration
        core.info(`🤖 EquilateralAgents GitHub Action`);
        core.info(`Workflow: ${workflowType}`);
        core.info(`Project: ${projectPath}`);
        core.info(`AI Provider: ${llmProvider}`);
        core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);

        // Configure orchestrator
        const orchestrator = new AgentOrchestrator({
            projectPath,
            metadata: {
                source: 'github-action',
                repository: `${context.repo.owner}/${context.repo.repo}`,
                sha: context.sha,
                ref: context.ref,
                workflow: context.workflow,
                job: context.job,
                actor: context.actor,
                eventName: context.eventName,
                pr: context.payload.pull_request?.number
            }
        });

        // Configure AI if enabled
        if (aiEnabled && llmProvider !== 'none') {
            process.env.LLM_PROVIDER = llmProvider;

            // Map GitHub secrets to env vars
            if (llmProvider === 'openai' && process.env.OPENAI_API_KEY) {
                core.debug('OpenAI API key detected');
            } else if (llmProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
                core.debug('Anthropic API key detected');
            } else if (llmProvider === 'github') {
                core.debug('Using GitHub AI (via token)');
            }
        }

        // Start orchestrator
        await orchestrator.start();

        // Import and register agents
        const { registerGitHubAgents } = require('./agents');
        registerGitHubAgents(orchestrator, { octokit, context });

        // Execute workflow
        core.info(`Executing ${workflowType} workflow...`);
        const result = await orchestrator.executeWorkflow(workflowType);

        // Process results
        const summary = generateSummary(result);
        const issues = extractIssues(result);
        const criticalIssues = issues.filter(i => i.severity === 'critical');

        // Set outputs
        core.setOutput('results', JSON.stringify(result));
        core.setOutput('summary', summary);
        core.setOutput('issues-found', issues.length);
        core.setOutput('critical-issues', criticalIssues.length);

        // Create annotations for issues
        issues.forEach(issue => {
            const level = issue.severity === 'critical' ? 'error' : 'warning';
            const annotation = {
                path: issue.file || 'unknown',
                start_line: issue.line || 1,
                end_line: issue.line || 1,
                annotation_level: level === 'error' ? 'failure' : 'warning',
                message: issue.message,
                title: issue.title || 'Issue found'
            };

            if (level === 'error') {
                core.error(issue.message, annotation);
            } else {
                core.warning(issue.message, annotation);
            }
        });

        // Create PR comment if applicable
        if (createPRComment && context.payload.pull_request) {
            const comment = await createPullRequestComment(
                octokit,
                context,
                summary,
                issues,
                aiEnabled
            );
            core.setOutput('pr-comment-id', comment.id);
        }

        // Create check run if applicable
        if (createCheckRun) {
            const check = await createCheckRunReport(
                octokit,
                context,
                summary,
                issues,
                result
            );
            core.setOutput('check-run-id', check.id);
        }

        // Fail if critical errors found and configured to do so
        if (failOnErrors && criticalIssues.length > 0) {
            core.setFailed(`Found ${criticalIssues.length} critical issues`);
        }

        await orchestrator.stop();
        core.info('✅ Analysis complete');

    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
        console.error(error);
    }
}

/**
 * Generate summary from results
 */
function generateSummary(result) {
    const tasks = result.results || [];
    let summary = `Analyzed ${tasks.length} workflow tasks\n`;

    tasks.forEach(task => {
        if (task.result.summary) {
            summary += `\n${task.agentId}: ${task.result.summary}`;
        }
    });

    return summary;
}

/**
 * Extract issues from results
 */
function extractIssues(result) {
    const issues = [];
    const tasks = result.results || [];

    tasks.forEach(task => {
        if (task.result.issues) {
            issues.push(...task.result.issues);
        }
    });

    return issues;
}

/**
 * Create PR comment with results
 */
async function createPullRequestComment(octokit, context, summary, issues, aiEnabled) {
    const { owner, repo } = context.repo;
    const prNumber = context.payload.pull_request.number;

    let body = `## 🤖 EquilateralAgents Analysis\n\n`;
    body += `### Summary\n${summary}\n`;

    if (issues.length > 0) {
        body += `\n### Issues Found (${issues.length})\n\n`;

        const critical = issues.filter(i => i.severity === 'critical');
        const warnings = issues.filter(i => i.severity === 'warning');
        const info = issues.filter(i => i.severity === 'info');

        if (critical.length > 0) {
            body += `#### 🔴 Critical (${critical.length})\n`;
            critical.forEach(issue => {
                body += `- **${issue.file}:${issue.line || '?'}** - ${issue.message}\n`;
            });
            body += '\n';
        }

        if (warnings.length > 0) {
            body += `#### 🟡 Warnings (${warnings.length})\n`;
            warnings.forEach(issue => {
                body += `- **${issue.file}:${issue.line || '?'}** - ${issue.message}\n`;
            });
            body += '\n';
        }

        if (info.length > 0) {
            body += `#### ℹ️ Info (${info.length})\n`;
            info.forEach(issue => {
                body += `- **${issue.file}:${issue.line || '?'}** - ${issue.message}\n`;
            });
            body += '\n';
        }
    } else {
        body += `\n✅ No issues found!\n`;
    }

    body += `\n---\n`;
    body += `*Powered by [EquilateralAgents](https://github.com/marketplace/equilateral-agents)`;

    if (aiEnabled) {
        body += ` • AI-Enhanced Analysis Enabled`;
    }
    body += `*`;

    const comment = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body
    });

    return comment.data;
}

/**
 * Create check run report
 */
async function createCheckRunReport(octokit, context, summary, issues, result) {
    const { owner, repo } = context.repo;
    const criticalCount = issues.filter(i => i.severity === 'critical').length;

    const conclusion = criticalCount > 0 ? 'failure' : 'success';
    const title = criticalCount > 0
        ? `Found ${criticalCount} critical issues`
        : 'All checks passed';

    const check = await octokit.rest.checks.create({
        owner,
        repo,
        name: 'EquilateralAgents',
        head_sha: context.sha,
        status: 'completed',
        conclusion,
        output: {
            title,
            summary,
            text: JSON.stringify(result, null, 2)
        }
    });

    return check.data;
}

// Run the action
if (require.main === module) {
    run();
}

module.exports = { run };
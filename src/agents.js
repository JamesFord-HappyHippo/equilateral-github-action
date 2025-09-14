/**
 * GitHub-specific agent configurations
 *
 * Copyright (c) 2025 HappyHippo.ai
 * Licensed under Apache-2.0
 */

const {
    CodeAnalyzerAgent,
    TestOrchestrationAgent,
    SecurityScannerAgent,
    DeploymentValidationAgent
} = require('equilateral-agents-open-core/agents');

/**
 * Register GitHub-optimized agents
 */
function registerGitHubAgents(orchestrator, { octokit, context }) {
    // Enhanced Code Analyzer for GitHub
    const codeAnalyzer = new CodeAnalyzerAgent({
        agentId: 'github-code-analyzer',
        enableAI: process.env.LLM_PROVIDER !== 'none',
        metadata: {
            pr: context.payload.pull_request?.number,
            repo: `${context.repo.owner}/${context.repo.repo}`
        }
    });

    // Enhanced Test Runner for GitHub
    const testRunner = new TestOrchestrationAgent({
        agentId: 'github-test-runner',
        enableAI: process.env.LLM_PROVIDER !== 'none'
    });

    // Security Scanner for GitHub
    const securityScanner = new SecurityScannerAgent({
        agentId: 'github-security-scanner',
        enableAI: process.env.LLM_PROVIDER !== 'none',
        reportFormat: 'sarif'  // GitHub security format
    });

    // Deployment Validator
    const deploymentValidator = new DeploymentValidationAgent({
        agentId: 'github-deployment-validator',
        enableAI: process.env.LLM_PROVIDER !== 'none'
    });

    // Register all agents
    orchestrator.registerAgent(codeAnalyzer);
    orchestrator.registerAgent(testRunner);
    orchestrator.registerAgent(securityScanner);
    orchestrator.registerAgent(deploymentValidator);

    // Define GitHub-specific workflows
    orchestrator.getWorkflowDefinition = (workflowType) => {
        const workflows = {
            'code-review': {
                tasks: [
                    { agentId: 'github-code-analyzer', taskType: 'analyze' },
                    { agentId: 'github-security-scanner', taskType: 'scan' }
                ]
            },
            'full-analysis': {
                tasks: [
                    { agentId: 'github-code-analyzer', taskType: 'analyze' },
                    { agentId: 'github-security-scanner', taskType: 'scan' },
                    { agentId: 'github-test-runner', taskType: 'test' }
                ]
            },
            'pre-deploy': {
                tasks: [
                    { agentId: 'github-test-runner', taskType: 'test' },
                    { agentId: 'github-security-scanner', taskType: 'scan' },
                    { agentId: 'github-deployment-validator', taskType: 'validate' }
                ]
            },
            'security-scan': {
                tasks: [
                    { agentId: 'github-security-scanner', taskType: 'security_scan' }
                ]
            }
        };

        return workflows[workflowType] || { tasks: [] };
    };
}

module.exports = {
    registerGitHubAgents
};
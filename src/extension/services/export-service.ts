/**
 * Claude Code Workflow Studio - Export Service
 *
 * Handles workflow export to .claude format
 * Based on: /specs/001-cc-wf-studio/spec.md Export Format Details
 */

import * as path from 'node:path';
import type {
  AskUserQuestionNode,
  Connection,
  PromptNode,
  SubAgentNode,
  Workflow,
  WorkflowNode,
} from '../../shared/types/workflow-definition';
import type { FileService } from './file-service';

/**
 * Check if any export files already exist
 *
 * @param workflow - Workflow to export
 * @param fileService - File service instance
 * @returns Array of existing file paths (empty if no conflicts)
 */
export async function checkExistingFiles(
  workflow: Workflow,
  fileService: FileService
): Promise<string[]> {
  const existingFiles: string[] = [];
  const workspacePath = fileService.getWorkspacePath();

  const agentsDir = path.join(workspacePath, '.claude', 'agents');
  const commandsDir = path.join(workspacePath, '.claude', 'commands');

  // Check Sub-Agent files
  const subAgentNodes = workflow.nodes.filter((node) => node.type === 'subAgent') as SubAgentNode[];
  for (const node of subAgentNodes) {
    const fileName = nodeNameToFileName(node.name);
    const filePath = path.join(agentsDir, `${fileName}.md`);
    if (await fileService.fileExists(filePath)) {
      existingFiles.push(filePath);
    }
  }

  // Check SlashCommand file
  const commandFileName = nodeNameToFileName(workflow.name);
  const commandFilePath = path.join(commandsDir, `${commandFileName}.md`);
  if (await fileService.fileExists(commandFilePath)) {
    existingFiles.push(commandFilePath);
  }

  return existingFiles;
}

/**
 * Export workflow to .claude format
 *
 * @param workflow - Workflow to export
 * @param fileService - File service instance
 * @returns Array of exported file paths
 */
export async function exportWorkflow(
  workflow: Workflow,
  fileService: FileService
): Promise<string[]> {
  const exportedFiles: string[] = [];
  const workspacePath = fileService.getWorkspacePath();

  // Create .claude directories if they don't exist
  const agentsDir = path.join(workspacePath, '.claude', 'agents');
  const commandsDir = path.join(workspacePath, '.claude', 'commands');

  await fileService.createDirectory(path.join(workspacePath, '.claude'));
  await fileService.createDirectory(agentsDir);
  await fileService.createDirectory(commandsDir);

  // Export Sub-Agent nodes
  const subAgentNodes = workflow.nodes.filter((node) => node.type === 'subAgent') as SubAgentNode[];
  for (const node of subAgentNodes) {
    const fileName = nodeNameToFileName(node.name);
    const filePath = path.join(agentsDir, `${fileName}.md`);
    const content = generateSubAgentFile(node);
    await fileService.writeFile(filePath, content);
    exportedFiles.push(filePath);
  }

  // Export SlashCommand
  const commandFileName = nodeNameToFileName(workflow.name);
  const commandFilePath = path.join(commandsDir, `${commandFileName}.md`);
  const commandContent = generateSlashCommandFile(workflow);
  await fileService.writeFile(commandFilePath, commandContent);
  exportedFiles.push(commandFilePath);

  return exportedFiles;
}

/**
 * Validate .claude file format
 *
 * @param content - File content to validate
 * @param fileType - Type of file ('subAgent' or 'slashCommand')
 * @throws Error if validation fails
 */
export function validateClaudeFileFormat(
  content: string,
  fileType: 'subAgent' | 'slashCommand'
): void {
  // Check if content is non-empty
  if (!content || content.trim().length === 0) {
    throw new Error('File content is empty');
  }

  // Check UTF-8 encoding (string should not contain replacement characters)
  if (content.includes('\uFFFD')) {
    throw new Error('File content contains invalid UTF-8 characters');
  }

  // Check YAML frontmatter format
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    throw new Error('Missing or invalid YAML frontmatter (must start and end with ---)');
  }

  const frontmatterContent = match[1];

  // Validate required fields based on file type
  if (fileType === 'subAgent') {
    if (!frontmatterContent.includes('name:')) {
      throw new Error('Sub-Agent file missing required field: name');
    }
    if (!frontmatterContent.includes('description:')) {
      throw new Error('Sub-Agent file missing required field: description');
    }
    if (!frontmatterContent.includes('model:')) {
      throw new Error('Sub-Agent file missing required field: model');
    }
  } else if (fileType === 'slashCommand') {
    if (!frontmatterContent.includes('description:')) {
      throw new Error('SlashCommand file missing required field: description');
    }
    if (!frontmatterContent.includes('allowed-tools:')) {
      throw new Error('SlashCommand file missing required field: allowed-tools');
    }
  }

  // Check that there's content after frontmatter (prompt body)
  const bodyContent = content.substring(match[0].length).trim();
  if (bodyContent.length === 0) {
    throw new Error('File is missing prompt body content after frontmatter');
  }
}

/**
 * Convert node name to filename
 *
 * @param name - Node name
 * @returns Filename (lowercase, spaces to hyphens)
 */
export function nodeNameToFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

/**
 * Generate Sub-Agent configuration file content
 *
 * @param node - Sub-Agent node
 * @returns Markdown content with YAML frontmatter
 */
function generateSubAgentFile(node: SubAgentNode): string {
  const { name, data } = node;
  const agentName = nodeNameToFileName(name);

  // YAML frontmatter
  const frontmatter = ['---', `name: ${agentName}`, `description: ${data.description || name}`];

  // Add optional fields
  if (data.tools && data.tools.length > 0) {
    frontmatter.push(`tools: ${data.tools}`);
  }

  if (data.model) {
    frontmatter.push(`model: ${data.model}`);
  } else {
    frontmatter.push('model: sonnet');
  }

  frontmatter.push('---');
  frontmatter.push('');

  // Prompt body
  const prompt = data.prompt || '';

  return frontmatter.join('\n') + prompt;
}

/**
 * Generate SlashCommand file content
 *
 * @param workflow - Workflow definition
 * @returns Markdown content with YAML frontmatter
 */
function generateSlashCommandFile(workflow: Workflow): string {
  // YAML frontmatter
  const frontmatter = [
    '---',
    `description: ${workflow.description || workflow.name}`,
    'allowed-tools: Task,AskUserQuestion',
    '---',
    '',
  ].join('\n');

  // Workflow execution logic
  const executionLogic = generateWorkflowExecutionLogic(workflow);

  return frontmatter + executionLogic;
}

/**
 * Generate workflow execution logic
 *
 * @param workflow - Workflow definition
 * @returns Markdown text with execution instructions
 */
function generateWorkflowExecutionLogic(workflow: Workflow): string {
  const { nodes, connections } = workflow;
  const instructions: string[] = [];

  // Filter out Start/End nodes only (Prompt is executable)
  // Note: Use type assertion to handle new node types (start, end, prompt)
  const executableNodes = nodes.filter(
    (node) => (node.type as string) !== 'start' && (node.type as string) !== 'end'
  );

  // Find start node (executable node with no incoming connections or connected from Start node)
  const targetNodeIds = new Set(connections.map((conn) => conn.to));
  const startNodeConnections = connections.filter((conn) =>
    nodes.find((n) => n.id === conn.from && (n.type as string) === 'start')
  );

  let startNodes = executableNodes.filter((node) => !targetNodeIds.has(node.id));

  // If no start nodes found, try to find nodes connected from Start node
  if (startNodes.length === 0 && startNodeConnections.length > 0) {
    startNodes = startNodeConnections
      .map((conn) => executableNodes.find((n) => n.id === conn.to))
      .filter((n) => n !== undefined) as WorkflowNode[];
  }

  if (startNodes.length === 0) {
    return 'エラー: 実行可能な開始ノードが見つかりません。';
  }

  // Build execution flow from start node
  const visited = new Set<string>();
  const queue = [...startNodes];

  while (queue.length > 0) {
    const currentNode = queue.shift();
    if (!currentNode || visited.has(currentNode.id)) {
      continue;
    }
    visited.add(currentNode.id);

    // Generate instruction for current node
    const nodeType = currentNode.type as string;

    if (nodeType === 'subAgent') {
      const agentName = nodeNameToFileName(currentNode.name);
      instructions.push(`Taskツールを使用して「${agentName}」Sub-Agentを実行してください。`);
      instructions.push('');

      // Find next nodes (skip End nodes)
      const outgoingConnections = connections.filter((conn) => conn.from === currentNode.id);
      const nextNodes = outgoingConnections
        .map((conn) => executableNodes.find((n) => n.id === conn.to))
        .filter((n) => n !== undefined);

      queue.push(...nextNodes);
    } else if (nodeType === 'askUserQuestion') {
      const askNode = currentNode as AskUserQuestionNode;
      const branchingLogic = generateBranchingLogic(askNode, executableNodes, connections);
      instructions.push(branchingLogic);
      instructions.push('');

      // Add branching nodes to queue (skip End nodes)
      const outgoingConnections = connections.filter((conn) => conn.from === currentNode.id);
      const nextNodes = outgoingConnections
        .map((conn) => executableNodes.find((n) => n.id === conn.to))
        .filter((n) => n !== undefined);

      queue.push(...nextNodes);
    } else if (nodeType === 'prompt') {
      // Prompt node: just output the prompt text
      const promptData = (currentNode as PromptNode).data;
      const promptText = promptData?.prompt || '';
      if (promptText) {
        instructions.push(promptText);
        instructions.push('');
      }

      // Find next nodes (skip End nodes)
      const outgoingConnections = connections.filter((conn) => conn.from === currentNode.id);
      const nextNodes = outgoingConnections
        .map((conn) => executableNodes.find((n) => n.id === conn.to))
        .filter((n) => n !== undefined);

      queue.push(...nextNodes);
    }
  }

  return instructions.join('\n');
}

/**
 * Generate AskUserQuestion branching logic
 *
 * @param node - AskUserQuestion node
 * @param allNodes - All workflow nodes
 * @param connections - All connections
 * @returns Markdown text with branching instructions
 */
function generateBranchingLogic(
  node: AskUserQuestionNode,
  allNodes: WorkflowNode[],
  connections: Connection[]
): string {
  const { data } = node;
  const instructions: string[] = [];

  instructions.push('AskUserQuestionツールを使用して以下の質問をユーザーに行ってください:');
  instructions.push(`- 質問: "${data.questionText}"`);
  instructions.push('- 選択肢:');

  // Find outgoing connections for each option
  const outgoingConnections = connections.filter((conn) => conn.from === node.id);

  for (const option of data.options) {
    const connection = outgoingConnections.find((conn) => conn.condition === option.label);
    if (connection) {
      const targetNode = allNodes.find((n) => n.id === connection.to);
      if (targetNode && targetNode.type === 'subAgent') {
        const agentName = nodeNameToFileName(targetNode.name);
        instructions.push(`  - "${option.label}" → Taskツールで「${agentName}」Sub-Agentを実行`);
      }
    } else {
      instructions.push(`  - "${option.label}" → (未接続)`);
    }
  }

  instructions.push('');
  instructions.push('ユーザーの選択に応じて、対応するSub-Agentを実行してください。');

  return instructions.join('\n');
}

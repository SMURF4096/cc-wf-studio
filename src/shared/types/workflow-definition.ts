/**
 * Claude Code Workflow Studio - Workflow Definition Types
 *
 * Based on: /specs/001-cc-wf-studio/data-model.md
 */

// ============================================================================
// Core Enums
// ============================================================================

export enum NodeType {
  SubAgent = 'subAgent',
  AskUserQuestion = 'askUserQuestion',
  Start = 'start',
  End = 'end',
  Prompt = 'prompt',
}

// ============================================================================
// Base Types
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface WorkflowMetadata {
  tags?: string[];
  author?: string;
  [key: string]: unknown;
}

// ============================================================================
// Node Data Types
// ============================================================================

export interface SubAgentData {
  description: string;
  prompt: string;
  tools?: string;
  model?: 'sonnet' | 'opus' | 'haiku';
  outputPorts: number;
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface AskUserQuestionData {
  questionText: string;
  options: QuestionOption[];
  outputPorts: number; // 2-4
}

export interface StartNodeData {
  label?: string;
}

export interface EndNodeData {
  label?: string;
}

export interface PromptNodeData {
  label?: string;
  prompt: string;
  variables?: Record<string, string>;
}

// ============================================================================
// Node Types
// ============================================================================

export interface BaseNode {
  id: string;
  type: NodeType;
  name: string;
  position: Position;
}

export interface SubAgentNode extends BaseNode {
  type: NodeType.SubAgent;
  data: SubAgentData;
}

export interface AskUserQuestionNode extends BaseNode {
  type: NodeType.AskUserQuestion;
  data: AskUserQuestionData;
}

export interface StartNode extends BaseNode {
  type: NodeType.Start;
  data: StartNodeData;
}

export interface EndNode extends BaseNode {
  type: NodeType.End;
  data: EndNodeData;
}

export interface PromptNode extends BaseNode {
  type: NodeType.Prompt;
  data: PromptNodeData;
}

export type WorkflowNode = SubAgentNode | AskUserQuestionNode | StartNode | EndNode | PromptNode;

// ============================================================================
// Connection Type
// ============================================================================

export interface Connection {
  id: string;
  from: string; // Node ID
  to: string; // Node ID
  fromPort: string; // Handle ID
  toPort: string; // Handle ID
  condition?: string; // Option label for AskUserQuestion branches
}

// ============================================================================
// Workflow Type
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  /**
   * スキーマバージョン (省略可能)
   *
   * ワークフローファイル形式のバージョンを示します。
   * - 省略時: "1.0.0" (既存形式、新規ノードタイプ非対応)
   * - "1.1.0": Start/End/Promptノードをサポート
   *
   * @default "1.0.0"
   */
  schemaVersion?: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: WorkflowMetadata;
}

// ============================================================================
// Validation Rules (for reference)
// ============================================================================

export const VALIDATION_RULES = {
  WORKFLOW: {
    MAX_NODES: 50,
    NAME_MIN_LENGTH: 1,
    NAME_MAX_LENGTH: 100,
    VERSION_PATTERN: /^\d+\.\d+\.\d+$/,
  },
  NODE: {
    NAME_MIN_LENGTH: 1,
    NAME_MAX_LENGTH: 50,
    NAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
  },
  SUB_AGENT: {
    DESCRIPTION_MIN_LENGTH: 1,
    DESCRIPTION_MAX_LENGTH: 200,
    PROMPT_MIN_LENGTH: 1,
    PROMPT_MAX_LENGTH: 10000,
    OUTPUT_PORTS: 1,
  },
  ASK_USER_QUESTION: {
    QUESTION_MIN_LENGTH: 1,
    QUESTION_MAX_LENGTH: 500,
    OPTIONS_MIN_COUNT: 2,
    OPTIONS_MAX_COUNT: 4,
    OPTION_LABEL_MIN_LENGTH: 1,
    OPTION_LABEL_MAX_LENGTH: 50,
    OPTION_DESCRIPTION_MIN_LENGTH: 1,
    OPTION_DESCRIPTION_MAX_LENGTH: 200,
  },
} as const;

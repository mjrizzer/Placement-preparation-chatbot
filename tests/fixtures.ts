import type { Evaluation, GeneratedQuestion } from '../src/lib/contracts';
export const question: GeneratedQuestion = {
  title: 'Collection lookup',
  question: 'Explain a lookup tradeoff in a collection.',
  topic: 'Language Fundamentals',
  concept: 'Random access tradeoff',
  difficulty: 'medium',
  kind: 'technical',
  expectedConcepts: ['indexing'],
  explanation: 'Indexed access depends on storage layout.',
  hints: ['Think about the layout.', 'Consider how you reach an element.'],
  followUpPossible: true,
  coding: null,
};
export const evaluation: Evaluation = {
  technicalAccuracy: 7,
  problemSolving: 8,
  communication: 6,
  completeness: 7,
  reasoning: 8,
  timeComplexity: 'O(1) indexed access',
  spaceComplexity: 'O(n)',
  confidenceEvidence: 'The answer includes explicit reasoning but leaves a claim unsupported.',
  wellDone: ['Explained indexing.'],
  improve: ['Compare traversal costs.'],
  correctAnswer: 'Contiguous storage permits indexed access.',
  followUp: 'How does insertion change the tradeoff?',
  mistakes: [
    {
      type: 'Incomplete answer',
      topic: 'Language Fundamentals',
      explanation: 'Omitted traversal.',
      correction: 'Explain sequential traversal.',
    },
  ],
};
export const plan = {
  summary: 'Focus on the gaps observed in collection knowledge.',
  tasks: Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    title: 'Practice collection tradeoffs',
    topic: 'Language Fundamentals',
    mode: 'Technical' as const,
    minutes: 20,
  })),
};
export const profile = {
  name: 'Test Student',
  college: 'Test College',
  degree: 'B.Tech',
  branch: 'CSE',
  graduationYear: 2027,
  level: 'intermediate',
  role: 'Software Developer',
  languages: ['Python'],
  areas: ['Arrays'],
};

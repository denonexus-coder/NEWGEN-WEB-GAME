export interface AIConfig {
  perceptionRadius: number;
  perceptionAngle: number;
  predictionTimeHorizon: number;
  dangerZoneRadius: number;
  criticalDangerRadius: number;
  offsideLineThreshold: number;

  utilityThreshold: number;
  riskTolerance: number;
  explorationRate: number;
  exploitationRate: number;

  personalityInfluence: number;
  emotionInfluence: number;
  memoryInfluence: number;

  creativityBoost: number;
  randomnessFactor: number;

  shortTermMemorySize: number;
  longTermMemorySize: number;
  memoryDecayRate: number;

  learningRate: number;
  adaptationRate: number;

  maxNpuCalculationsPerFrame: number;
  updateRate: number;
}

export function createDefaultAIConfig(): AIConfig {
  return {
    perceptionRadius: 50,
    perceptionAngle: 180,
    predictionTimeHorizon: 2,
    dangerZoneRadius: 25,
    criticalDangerRadius: 12,
    offsideLineThreshold: 1,

    utilityThreshold: 30,
    riskTolerance: 0.3,
    explorationRate: 0.1,
    exploitationRate: 0.9,

    personalityInfluence: 0.6,
    emotionInfluence: 0.3,
    memoryInfluence: 0.2,

    creativityBoost: 10,
    randomnessFactor: 0.05,

    shortTermMemorySize: 20,
    longTermMemorySize: 100,
    memoryDecayRate: 0.95,

    learningRate: 0.01,
    adaptationRate: 0.05,

    maxNpuCalculationsPerFrame: 100,
    updateRate: 10,
  };
}
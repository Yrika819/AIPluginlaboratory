export const AI_LIMITS = Object.freeze({
  mobileBudgetBytes: 256 * 1024 * 1024,
  desktopBudgetBytes: 512 * 1024 * 1024,
  maxOutputPixels: 40_000_000,
});

export function estimateAiMemory({
  width,
  height,
  coreSize,
  padding,
  modelScale = 4,
  outputScale = 2,
} = {}) {
  const w = Number(width);
  const h = Number(height);
  const core = Number(coreSize);
  const pad = Number(padding);
  if (!(w > 0) || !(h > 0) || !(core > 0) || !(pad >= 0)) {
    throw new Error("Invalid AI memory estimate input.");
  }

  const tileInput = Math.min(w, core + pad * 2) * Math.min(h, core + pad * 2);
  const tileOutput = tileInput * modelScale * modelScale;
  const sourceRgba = w * h * 4;
  const destinationRgba = w * outputScale * h * outputScale * 4;
  const inputTensor = tileInput * 3 * 4;
  const outputTensor = tileOutput * 3 * 4;
  // Convolution intermediates dominate; 64 channels with a conservative 3x reuse factor.
  const featureEstimate = tileInput * 64 * 4 * 3;

  const estimatedBytes =
    sourceRgba + destinationRgba + inputTensor + outputTensor + featureEstimate;

  return {
    estimatedBytes,
    outputPixels: w * outputScale * h * outputScale,
    sourceRgba,
    destinationRgba,
    tileWorkingSet: inputTensor + outputTensor + featureEstimate,
  };
}

export function validateAiBudget(input, {
  mobile = false,
  limits = AI_LIMITS,
} = {}) {
  const estimate = estimateAiMemory(input);
  const budgetBytes = mobile ? limits.mobileBudgetBytes : limits.desktopBudgetBytes;
  return {
    ...estimate,
    budgetBytes,
    safe: estimate.estimatedBytes <= budgetBytes && estimate.outputPixels <= limits.maxOutputPixels,
    reason:
      estimate.outputPixels > limits.maxOutputPixels
        ? "Output image is too large for the AI safety limit."
        : estimate.estimatedBytes > budgetBytes
          ? "Estimated AI working memory exceeds the device safety budget."
          : "",
  };
}

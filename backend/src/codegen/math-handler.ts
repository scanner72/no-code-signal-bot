export class MathHandler {
  static generateMathTranspilation(expression: string): string {
    return expression
      .replace(/math\.abs\(/g, 'abs(')
      .replace(/math\.max\(/g, 'max(')
      .replace(/math\.min\(/g, 'min(')
      .replace(/math\.round\(/g, 'round(')
      .replace(/math\.ceil\(/g, 'math.ceil(')
      .replace(/math\.floor\(/g, 'math.floor(')
      .replace(/math\.sqrt\(/g, 'math.sqrt(')
      .replace(/math\.pow\(/g, 'math.pow(')
      .replace(/math\.log\(/g, 'math.log(');
  }
}

export default MathHandler;

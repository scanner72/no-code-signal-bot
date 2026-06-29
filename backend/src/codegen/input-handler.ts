/**
 * Input parameter handler - generates Python code for user-configurable parameters
 */

export class InputHandler {
  /**
   * Generate Python code for input parameters
   *
   * Example output:
   *   # User-configurable parameters
   *   RSI_PERIOD = 14  # type: int, range: 2-50
   *   THRESHOLD = 50.0  # type: float
   *   USE_FILTER = True  # type: bool
   */
  static generateInputDefinitions(inputParams: any[]): string {
    let code = '# ═══ User-Configurable Parameters ═══\n';

    for (const param of inputParams) {
      const { paramName, type, defaultValue, minValue, maxValue, title } = param;

      // Format default value based on type
      let formattedValue: string;
      if (type === 'bool') {
        formattedValue = defaultValue ? 'True' : 'False';
      } else if (type === 'float') {
        formattedValue = `${parseFloat(defaultValue)}.0`;
      } else {
        formattedValue = String(defaultValue);
      }

      // Build comment with metadata
      let comment = `# type: ${type}`;
      if (minValue !== undefined || maxValue !== undefined) {
        comment += ', range: ';
        if (minValue !== undefined) comment += minValue;
        if (minValue !== undefined && maxValue !== undefined) comment += '-';
        if (maxValue !== undefined) comment += maxValue;
      }
      if (title) {
        comment += ` | ${title}`;
      }

      code += `${paramName.toUpperCase()} = ${formattedValue}  ${comment}\n`;
    }

    code += '\n';
    return code;
  }

  /**
   * Generate parameter validation function
   */
  static generateParameterValidator(inputParams: any[]): string {
    let code = 'def validate_parameters():\n';
    code += '    """Validate user-provided parameters are within acceptable ranges."""\n';
    code += '    errors = []\n\n';

    for (const param of inputParams) {
      const { paramName, type, minValue, maxValue } = param;
      const varName = paramName.toUpperCase();

      if (type === 'int' || type === 'float') {
        if (minValue !== undefined) {
          code += `    if ${varName} < ${minValue}:\n`;
          code += `        errors.append(f"${paramName} must be >= ${minValue}, got {${varName}}")\n`;
        }
        if (maxValue !== undefined) {
          code += `    if ${varName} > ${maxValue}:\n`;
          code += `        errors.append(f"${paramName} must be <= ${maxValue}, got {${varName}}")\n`;
        }
      }
    }

    code += '\n    if errors:\n';
    code += '        raise ValueError("Parameter validation failed:\\n" + "\\n".join(errors))\n';
    code += '\n';
    return code;
  }

  /**
   * Generate parameter documentation
   */
  static generateParameterDocs(inputParams: any[]): string {
    let docs = '"""Strategy Parameters\n\n';

    for (const param of inputParams) {
      const { paramName, type, defaultValue, minValue, maxValue, title } = param;
      docs += `- ${paramName} (${type}): ${title || 'No description'}\n`;
      docs += `  Default: ${defaultValue}`;
      if (minValue !== undefined || maxValue !== undefined) {
        docs += ` | Range: ${minValue || '?'} - ${maxValue || '?'}`;
      }
      docs += '\n';
    }

    docs += '\n"""\n';
    return docs;
  }

  /**
   * Override parameter values from strategy config
   */
  static generateParameterOverrides(inputParams: any[]): string {
    let code = '# Override parameters from strategy config if provided\n';
    code += 'if strategy_config and "parameters" in strategy_config:\n';
    code += '    params = strategy_config["parameters"]\n';

    for (const param of inputParams) {
      const { paramName, type } = param;
      const varName = paramName.toUpperCase();

      if (type === 'bool') {
        code += `    if "${paramName}" in params:\n`;
        code += `        ${varName} = params["${paramName}"].lower() in ("true", "1", "yes")\n`;
      } else if (type === 'int') {
        code += `    if "${paramName}" in params:\n`;
        code += `        ${varName} = int(params["${paramName}"])\n`;
      } else if (type === 'float') {
        code += `    if "${paramName}" in params:\n`;
        code += `        ${varName} = float(params["${paramName}"])\n`;
      } else {
        code += `    if "${paramName}" in params:\n`;
        code += `        ${varName} = params["${paramName}"]\n`;
      }
    }

    code += '\n    validate_parameters()\n\n';
    return code;
  }
}

export default InputHandler;

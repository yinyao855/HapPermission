export class ReporterFormat {
  // 定义静态常量
  static readonly FLAG_JSON: number = 0;
  static readonly FLAG_EXCEL: number = 1;
  static readonly FLAG_DEBUG: number = 2;

  // 定义格式映射表
  static readonly formatMap: Map<string, number> = new Map([
    ['json', ReporterFormat.FLAG_JSON],
    ['excel', ReporterFormat.FLAG_EXCEL],
    ['debug', ReporterFormat.FLAG_DEBUG]
  ]);

  /**
   * 根据格式名称获取对应的标志值
   * @param format - 格式名称，如 'json', 'excel', 'debug'
   * @returns 对应的标志值，如果格式名称无效则返回 FLAG_EXCEL
   */
  static getFlag(format: string | undefined): number {
    return format && this.formatMap.has(format) 
      ? this.formatMap.get(format)! 
      : this.FLAG_EXCEL;
  }
}

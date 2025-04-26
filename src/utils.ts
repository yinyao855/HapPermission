import JSON5 from 'json5';
import path from 'path';
import fs from 'fs';

export class Project {
  projectPath: string;
  nonProject: boolean;
  logTag: string;
  profile: any;
  sdkPath: string | undefined;

  constructor(projectPath: string, nonProject: boolean) {
    this.projectPath = projectPath;
    this.nonProject = nonProject;
    this.logTag = 'Project';
    this.profile = null;
    this.sdkPath = undefined;
  }

  // 获取项目路径
  getPath(): string {
    return this.projectPath;
  }

  // 获取项目build-profile.json5文件信息
  getProfile(): any {
    if (!this.profile) {
      const buildProfilePath = path.resolve(this.projectPath, 'build-profile.json5');
      if (!fs.existsSync(buildProfilePath)) {
        Logger.error(this.logTag, 'build-profile.json5 can\'t be found, is it an openharmony project?');
        return this.profile;
      }
      const profileContent = fs.readFileSync(buildProfilePath, 'utf-8');
      try {
        this.profile = JSON5.parse(profileContent);
      } catch (ex) {
        Logger.error(this.logTag, `parse build-profile.json5 error: ${JSON.stringify(ex)}`);
      }
    }
    return this.profile;
  }

  // 获取项目的权限声明列表
  getPermissionList(): string[] {
    let permissionList: string[] = [];
    const moduleFilePath = path.resolve(this.projectPath, 'entry/src/main/module.json5');
    if (!fs.existsSync(moduleFilePath)) {
      Logger.error(this.logTag, 'module.json5 can\'t be found, is it an openharmony project?');
      return permissionList;
    }
    const moduleFileContent = fs.readFileSync(moduleFilePath, 'utf-8');
    try {
      const moduleInfo = JSON5.parse(moduleFileContent);
      const requestPermissions = moduleInfo.module?.requestPermissions;
      if (requestPermissions) {
        for (const permission of requestPermissions) {
            permissionList.push(permission.name);
        }
      }
    } catch (e) {
      Logger.error(this.logTag, `parse module.json5 error: ${JSON.stringify(e)}`);
    }
    return permissionList;
  }

  // 获取sdk版本
  getAppSdkVersion(): string | undefined {
    const profile = this.getProfile();

    if (!profile) {
      return undefined;
    }

    if (!profile.app) {
      return undefined;
    }

    if (profile.app.compileSdkVersion) {
      return profile.app.compileSdkVersion;
    }

    if (profile.app.products) {
      const compileSdkVersion = profile.app.products[0].compileSdkVersion;
      if (typeof compileSdkVersion === 'number') {
        return compileSdkVersion.toString();
      }
      const matchResult = compileSdkVersion.match(/\((.+)\)/g);
      if (matchResult) {
        return matchResult[0].replace(/[()]/g, '');
      }
    }
    return undefined;
  }

  // 获取sdk路径
  getAppSdkPath(): string | undefined {
    if (this.sdkPath) {
      return this.sdkPath;
    }
    const localPropertiesPath = path.resolve(this.projectPath, 'local.properties');
    if (!fs.existsSync(localPropertiesPath)) {
      Logger.error(this.logTag, 'unable to get the sdk path of the project, specify it using the --sdk or --sdkRoot');
      return this.sdkPath;
    }
    const properties = this.parseProperty(localPropertiesPath);
    this.sdkPath = properties.get('sdk.dir');
    return this.sdkPath;
  }

  // 解析local.properties文件
  parseProperty(propertyFilePath: string): Map<string, string> {
    const properties = fs.readFileSync(propertyFilePath, 'utf-8');
    const lines = properties.split('\n');
    const propertyRegExp = new RegExp(/(.*)=(.*)/);
    const map = new Map<string, string>();
    lines.forEach((line) => {
      if (line.startsWith('#')) {
        return;
      }
      const expArray = line.match(propertyRegExp);
      const MATCHED_RESULT_NUMBER = 3;
      const KEY_INDEX = 1;
      const VALUE_INDEX = 2;
      if (expArray && expArray.length === MATCHED_RESULT_NUMBER) {
        map.set(expArray[KEY_INDEX].trim(), expArray[VALUE_INDEX].trim());
      }
    });
    return map;
  }

  /**
   * 获取应用的源码列表
   *
   * @param isIncludeTest 是否包含测试代码
   * @returns 应用源码路径集合
   */
  getAppSources(isIncludeTest: boolean): Set<string> {
    if (this.nonProject) {
      return this.getNonProjectAppSources();
    }
    const profile = this.getProfile();
    // 如果没有模块信息，返回空集合
    if (!profile?.modules?.length) {
      return new Set();
    }
    const moduleSrcPaths: string[] = [];
    profile.modules.forEach((module: any) => {
      if (module.srcPath) {
        moduleSrcPaths.push(path.resolve(this.projectPath, module.srcPath));
      }
    });
    const appSources: string[] = [];
    moduleSrcPaths.forEach((moduleSrc) => {
      appSources.push(...this.getModuleSource(moduleSrc, isIncludeTest));
    });
    return new Set(appSources);
  }

  // 获取非项目文件源代码路径集合
  getNonProjectAppSources(): Set<string> {
    Logger.info(this.logTag, 'find source files in non-project');
    const appSources: string[] = [];
    this.listSourceFiles(this.projectPath, appSources);
    return new Set(appSources);
  }

  // 获取模块的源代码路径集合
  getModuleSource(modulePath: string, isIncludeTest: boolean): string[] {
    const sourceSets = ['src/main/ets'];
    if (isIncludeTest) {
      sourceSets.push(...['src/ohosTest/ets']);
    }
    const sources: string[] = [];
    sourceSets.forEach((sourcePath) => {
      const srcPath = path.resolve(modulePath, sourcePath);
      this.listSourceFiles(srcPath, sources);
    });
    if (sources.length === 0) {
      Logger.info(this.logTag, `can't find source file in ${this.projectPath}`);
    }
    return sources;
  }

  listSourceFiles(srcPath: string, dest: string[]): void {
    if (fs.existsSync(srcPath)) {
      Logger.info(this.logTag, `find source code in ${srcPath}`);
      FileSystem.listFiles(srcPath, (filePath) => {
        const fileName = path.basename(filePath);
        return fileName.endsWith('.ts') || fileName.endsWith('.ets');
      }, dest);
    }
  }
}

// sdk 相关信息
export class Sdk {
  project: Project;
  sdkEtsPath: string | undefined;
  sdkRoot: string | undefined;
  sdkApiRoot: string | undefined;
  apiLibs: string[] | undefined;
  componentLibs: string[] | undefined;
  esLibs: string[] | undefined;

  /**
   * 
   * @param project 应用工程对象
   * @param sdkEtsPath 指向sdk中ets目录的路径
   * @param sdkRoot sdk根目录
   */
  constructor(project: Project, sdkEtsPath: string | undefined, sdkRoot: string | undefined) {
    this.project = project;
    this.sdkEtsPath = sdkEtsPath;
    this.sdkRoot = sdkRoot;
  }

  // 获取sdk的ets目录路径
  getPath(): string | undefined {
    if (this.sdkEtsPath) {
      return this.sdkEtsPath;
    }
    if (this.sdkApiRoot) {
      return this.sdkApiRoot;
    }
    const sdkVersion = this.project.getAppSdkVersion();
    const sdkDir = this.sdkRoot ?? this.project.getAppSdkPath();
    if (sdkVersion && sdkDir) {
      this.sdkApiRoot = path.resolve(sdkDir, `${sdkVersion}`, 'ets');
    }
    return this.sdkApiRoot;
  }

  /**
   * 获取SDK的api的d.ts文件列表
   *
   * @returns api的d.ts文件列表
   */
  getApiLibs(): string[] {
    if (this.apiLibs) {
      return this.apiLibs;
    }
    this.apiLibs = [];
    this.listDtsFiles('api', this.apiLibs);
    return this.apiLibs;
  }

  /**
   * 获取SDK的component的d.ts文件列表
   *
   * @returns component的d.ts文件列表
   */
  getComponentLibs(): string[] {
    if (this.componentLibs) {
      return this.componentLibs;
    }
    this.componentLibs = [];
    this.listDtsFiles('component', this.componentLibs);
    return this.componentLibs;
  }

  getESLibs(libPath: string): string[] {
    if (!process.env.bundleMode) {
      return [];
    }
    Logger.info('Sdk', `find ES libs in ${libPath}`);
    if (this.esLibs) {
      return this.esLibs;
    }
    this.esLibs = [];
    FileSystem.listFiles(libPath, (filePath) => path.basename(filePath).endsWith('.d.ts'), this.esLibs);
    FileSystem.listFiles(libPath, (filePath) => path.basename(filePath).endsWith('.d.ets'), this.esLibs);
    return this.esLibs;
  }

  listDtsFiles(dir: string, dest: string[]): void {
    const sdkRoot = this.getPath();
    if (!sdkRoot) {
      return;
    }
    const subDir = path.resolve(sdkRoot, dir);
    FileSystem.listFiles(subDir, (filePath) => path.basename(filePath).endsWith('.d.ts'), dest);
    FileSystem.listFiles(subDir, (filePath) => path.basename(filePath).endsWith('.d.ets'), dest);
  }
}

// 文件系统相关操作
export class FileSystem {
  // 获取目录下满足条件的文件列表
  static listFiles(dir: string, filter: (filePath: string) => boolean, dest: string[]): void {
    const files = fs.readdirSync(dir);
    files.forEach((element) => {
      const filePath = path.join(dir, element);
      const status = fs.statSync(filePath);
      if (status.isDirectory()) {
        this.listFiles(filePath, filter, dest);
      } else if (filter(filePath)) {
        dest.push(this.convertToPosixPath(filePath));
      }
    });
  }

  // 转换路径为POSIX格式，即使用正斜杠分隔
  static convertToPosixPath(filePath: string): string {
    return filePath.split(path.sep).join(path.posix.sep);
  }

  // 判断路径是否在指定目录下
  static isInDirectory(parentDir: string, subPath: string): boolean {
    const relative = path.relative(parentDir, subPath);
    return (relative === '' || !relative.startsWith('..')) && !path.isAbsolute(relative);
  }

  // 获取指定目录下的所有应用目录
  // TODO: visitChildren逻辑还不清楚
  static listAllAppDirs(parentDir: string): string[] {
    const dest: string[] = [];
    this.listDirectory(parentDir, dest, (filePath) => {
      const buildProfilePath = path.resolve(filePath, 'build-profile.json5');
      if (!fs.existsSync(buildProfilePath)) {
        return false;
      }
      const profileContent = fs.readFileSync(buildProfilePath, 'utf-8');
      const profile = JSON5.parse(profileContent);
      return profile.app && profile.modules;
    }, (filePath) => {
      return this.isInDirectory(parentDir, filePath);
    });
    return dest;
  }

  static listDirectory(dir: string, dest: string[], filter: (filePath: string) => boolean, visitChildren: (filePath: string) => boolean): void {
    const files = fs.readdirSync(dir);
    files.forEach((element) => {
      const filePath = path.join(dir, element);
      const status = fs.statSync(filePath);
      if (status.isDirectory()) {
        if (filter(filePath)) {
          dest.push(filePath);
        } else if (visitChildren(filePath)) {
          this.listDirectory(filePath, dest, filter, visitChildren);
        }
      }
    });
  }
}

// 定义 Logger 类
export class Logger {
  static readonly INFO = 0;
  static readonly WARN = 1;
  static readonly ERROR = 2;
  static readonly logs = '';
  static readonly LEVEL_NAME = new Map([
    [Logger.INFO, 'I'],
    [Logger.WARN, 'W'],
    [Logger.ERROR, 'E']
  ]);

  static info(tag: string, message: string): void {
    this.wrap(this.INFO, tag, message);
  }

  static warn(tag: string, message: string): void {
    this.wrap(this.WARN, tag, message);
  }

  static error(tag: string, message: string): void {
    this.wrap(this.ERROR, tag, message);
  }

  static wrap(level: number, tag: string, message: string): void {
    const timeStamp = `${this.formatDate(Date.now(), 'Y-M-D H:m:s:x')}`;
    const logMessage = `${timeStamp} ${this.getLevelName(level)} [${tag}] ${message}`;
    console.log(logMessage);
  }

  static flush(output: string): void {
    const logName = path.resolve(output, `${this.formatDate(Date.now(), 'Y-M-D-Hmsx')}.log`);
    fs.writeFileSync(logName, this.logs);
    this.info('Logger', `log is in ${logName}`);
  }

  static getLevelName(level: number): string {
    if (this.LEVEL_NAME.has(level)) {
      return this.LEVEL_NAME.get(level)!;
    }
    return this.LEVEL_NAME.get(this.INFO)!;
  }

  static formatDate(time: number, format: string): string {
    const date = new Date(time);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const min = date.getMinutes();
    const sec = date.getSeconds();
    const mis = date.getMilliseconds();
    let dateStr = format.replace('Y', `${year}`);
    dateStr = dateStr.replace('M', `${month}`);
    dateStr = dateStr.replace('D', `${day}`);
    dateStr = dateStr.replace('H', `${hour}`);
    dateStr = dateStr.replace('m', `${min}`);
    dateStr = dateStr.replace('s', `${sec}`);
    dateStr = dateStr.replace('x', `${mis}`);
    return dateStr;
  }
}

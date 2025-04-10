import { Project, Sdk, FileSystem, Logger } from './utils';
import {ApiWriter, ApiExcelWriter} from './api_writer';
import { SystemApiRecognizer } from './api_recognizer';
import { ReporterFormat } from './configs';
import { CommandArgs } from './index'
import ts, {Path} from 'ohos-typescript';
import fs from 'fs';
import path from 'path';

// 定义 ProgramFactory 类
class ProgramFactory {
  libPath: string = '';
  compilerHost?: ts.CompilerHost;

  setLibPath(libPath: string): void {
    this.libPath = libPath;
  }

  getETSOptions(componentLibs: string[]): any {
    const etsConfig = require('../etsconfig.json');
    etsConfig.libs = [...componentLibs];
    return etsConfig;
  }

  createProgram(
    rootNames: string[],
    apiLibs: string[],
    componentLibs: string[],
    esLibs: string[]
  ): ts.Program {
    const compilerOption: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2017,
      ets: this.getETSOptions([]),
      allowJs: false,
      lib: [...apiLibs, ...componentLibs, ...esLibs],
      module: ts.ModuleKind.CommonJS,
    };
    this.compilerHost = this.createCompilerHost(
      {
        resolveModuleName: (moduleName: string) => {
          return this.resolveModuleName(moduleName, apiLibs);
        },
      },
      compilerOption
    );

    if (this.libPath && fs.existsSync(this.libPath)) {
      Logger.info('ProgramFactory', `set default lib location: ${this.libPath}`);
      this.compilerHost.getDefaultLibLocation = () => {
        return this.libPath;
      };
    }
    return ts.createProgram({
      rootNames: [...rootNames],
      options: compilerOption,
      host: this.compilerHost,
    });
  }

  resolveModuleName(moduleName: string, libs: string[]): string | undefined {
    if (moduleName.startsWith('@')) {
      const moduleFileName = `${moduleName}.d.ts`;
      const etsModuleFileName = `${moduleName}.d.ets`;
      for (const lib of libs) {
        if (lib.endsWith(moduleFileName) || lib.endsWith(etsModuleFileName)) {
          return lib;
        }
      }
    }
    return undefined;
  }

  createCompilerHost(
    moduleResolver: { resolveModuleName: (moduleName: string) => string | undefined },
    compilerOption: ts.CompilerOptions
  ): ts.CompilerHost {
    const compilerHost = ts.createCompilerHost(compilerOption);
    compilerHost.resolveModuleNames = this.getResolveModuleNames(moduleResolver);
    return compilerHost;
  }

  getResolveModuleNames(
    moduleResolver: { resolveModuleName: (moduleName: string) => string | undefined }
  ): (
    moduleNames: string[],
    containingFile: string,
    reusedNames: string[] | undefined,
    redirectedReference: ts.ResolvedProjectReference | undefined,
    options: ts.CompilerOptions
  ) => (ts.ResolvedModule | undefined)[] {
    return (moduleNames, containingFile, reusedNames, redirectedReference, options) => {
      const resolvedModules: (ts.ResolvedModule | undefined)[] = [];
      for (const moduleName of moduleNames) {
        const moduleLookupLocaton = ts.resolveModuleName(
          moduleName,
          containingFile,
          options,
          this.moduleLookupResolutionHost()
        );
        if (moduleLookupLocaton.resolvedModule) {
          resolvedModules.push(moduleLookupLocaton.resolvedModule);
        } else {
          const modulePath = moduleResolver.resolveModuleName(moduleName);
          const resolved = modulePath && fs.existsSync(modulePath)
            ? { resolvedFileName: modulePath }
            : undefined;
          resolvedModules.push(resolved);
        }
      }
      return resolvedModules;
    };
  }

  moduleLookupResolutionHost(): ts.ModuleResolutionHost {
    return {
      fileExists: (fileName: string) => {
        return !!fileName && fs.existsSync(fileName);
      },
      readFile: (fileName: string) => {
        return fs.readFileSync(fileName, 'utf-8');
      },
    };
  }
}

// 定义 ApiCollector 类
class ApiCollector {
  project: Project;
  sdk: Sdk;
  formatFlag: any;
  outputPath: string;
  logTag: string;
  debugFlag: boolean;
  noRepeat: boolean;
  libPath?: string;
  isIncludeTest: boolean;
  apiWriter?: ApiWriter;

  constructor(argv: CommandArgs) {
    let appProject: string | undefined;
    if (argv.app) {
      appProject = argv.app;
    } else if (argv.dir) {
      appProject = argv.dir;
    }

    if (!appProject) {
      throw new Error('app not found');
    }
    this.project = new Project(appProject, argv.dir !== undefined);
    this.sdk = new Sdk(this.project, argv.sdk, argv.sdkRoot);
    this.formatFlag = ReporterFormat.getFlag(argv.format);
    this.outputPath = argv.output ?? appProject;
    this.logTag = 'ApiCollector';
    this.debugFlag = argv.debug || false;
    this.noRepeat = argv.noRepeat || false;
    this.isIncludeTest = argv.scanTest || false;
  }

  setLibPath(libPath: string): this {
    this.libPath = libPath;
    if (libPath && !fs.existsSync(this.libPath)) {
      Logger.warn(this.logTag, `${libPath} is not exist`);
    } else {
      Logger.info(this.logTag, `set lib path ${libPath}`);
    }
    return this;
  }

  setIncludeTest(isIncludeTest: boolean): this {
    this.isIncludeTest = isIncludeTest;
    return this;
  }

  async start(): Promise<void> {
    const sdkPath = this.sdk.getPath();
    if (!sdkPath || !fs.existsSync(sdkPath)) {
      return;
    }
    const handleFilePath = path.join(sdkPath, '/api/@internal/full/global.d.ts');
    const originalContent = fs.readFileSync(handleFilePath, 'utf-8');
    // 去除import和export关键字
    let newContent = originalContent.replace(/import|export/g, '');
    fs.writeFileSync(handleFilePath, newContent);
    Logger.info(this.logTag, `scan app ${this.project.getPath()}`);
    Logger.info(this.logTag, `sdk is in ${sdkPath}`);
    const apiLibs = this.sdk.getApiLibs();
    const componentLibs = this.sdk.getComponentLibs();
    const eslibs = this.sdk.getESLibs(this.libPath!);
    const appSourceSet = this.project.getAppSources(this.isIncludeTest);
    const programFactory = new ProgramFactory();
    programFactory.setLibPath(this.libPath!);
    let program = programFactory.createProgram(Array.from(appSourceSet), apiLibs, componentLibs, eslibs);

    if (this.debugFlag) {
      program.getSourceFiles().forEach((sf) => {
        Logger.info('ApiCollector', sf.fileName);
      });
    }

    let systemApiRecognizer = new SystemApiRecognizer(sdkPath);
    systemApiRecognizer.setTypeChecker(program.getTypeChecker());
    systemApiRecognizer.buildScene();
    Logger.info(this.logTag, `start scanning ${this.project.getPath()}`);
    appSourceSet.forEach((appCodeFilePath) => {
      // 获取源文件的规范名称
      const canonicalFileName = programFactory.compilerHost!.getCanonicalFileName(appCodeFilePath);
      const sourceFile = program.getSourceFileByPath(<Path>canonicalFileName);
      if (sourceFile) {
        if (this.debugFlag) {
          Logger.info(this.logTag, `scan ${sourceFile.fileName}`);
        }
        systemApiRecognizer.recognize(sourceFile, sourceFile.fileName);
      } else {
        Logger.warn(this.logTag, `no sourceFile ${appCodeFilePath}`);
      }
    });
    Logger.info(this.logTag, `end scan ${this.project.getPath()}`);
    const apiWriter = this.getApiWriter();
    apiWriter.add(systemApiRecognizer.getApiInformations());
    // avoid oom
    // TODO: fix type error
    // systemApiRecognizer = undefined;
    // program = undefined;
    await apiWriter.flush();
    fs.writeFileSync(handleFilePath, originalContent);
  }

  getApiWriter(): ApiWriter {
    if (!this.apiWriter) {
      this.apiWriter = new ApiWriter(this.outputPath, this.formatFlag, this.noRepeat);
    }
    return this.apiWriter;
  }

  setApiWriter(apiWriter: ApiWriter): void {
    this.apiWriter = apiWriter;
  }
}

// 定义 MultiProjectApiCollector 类
class MultiProjectApiCollector {
  argv: CommandArgs;
  libPath?: string;
  isIncludeTest?: boolean;
  logTag = 'MultiProjectApiCollector';

  constructor(argv: CommandArgs) {
    this.argv = argv;
  }

  setLibPath(libPath: string): this {
    this.libPath = libPath;
    if (libPath && !fs.existsSync(this.libPath)) {
      Logger.warn(this.logTag, `${libPath} is not exist`);
    } else {
      Logger.info(this.logTag, `set lib path ${libPath}`);
    }
    return this;
  }

  setIncludeTest(isIncludeTest: boolean): this {
    this.isIncludeTest = isIncludeTest;
    return this;
  }

  async start(): Promise<void> {
    const allApps = FileSystem.listAllAppDirs(this.argv.appDir!);
    if (allApps.length === 0) {
      Logger.info('MultiProjectApiCollector', `project not found in ${this.argv.appDir}`);
      return;
    }
    const output = this.argv.output ?? this.argv.appDir!;
    const apiExcelWriter = new ApiExcelWriter(output, true);
    apiExcelWriter.close();
    allApps.forEach((app) => {
      if (app) {
        this.argv.app = app;
        const apiCollector = new ApiCollector(this.argv);
        // TODO: fix type error
        apiCollector.setApiWriter(<ApiWriter><unknown>apiExcelWriter);
        apiCollector.setLibPath(this.libPath!).setIncludeTest(this.isIncludeTest!).start();
      }
    });
    apiExcelWriter.open();
    await apiExcelWriter.flush();
  }
}

export { ApiCollector, MultiProjectApiCollector };

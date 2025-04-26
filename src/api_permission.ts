import { Project, Sdk, FileSystem, Logger } from './utils';
import {ApiWriter, ApiExcelWriter} from './api_writer';
import { SystemApiRecognizer } from './api_recognizer';
import { ReporterFormat } from './configs';
import { CommandArgs } from './index'
import fs from 'fs';
import {ApiAnalyzer} from "./api_analyzer";


export class ApiPermission {
  projectName: string;
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
    if (!argv.appName) {
      throw new Error('appName not found');
    }
    this.projectName = argv.appName;
    let appProject: string | undefined;
    // if (argv.app) {
    //   appProject = argv.app;
    // } else if (argv.dir) {
    //   appProject = argv.dir;
    // }
    appProject = argv.appDir;

    if (!appProject) {
      throw new Error('app not found');
    }
    this.project = new Project(appProject, false);
    this.sdk = new Sdk(this.project, argv.sdk, undefined);
    this.formatFlag = ReporterFormat.getFlag(argv.format);
    this.outputPath = argv.output ?? appProject;
    this.logTag = 'ApiPermission';
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

    Logger.info(this.logTag, `scan app ${this.project.getPath()}`);
    Logger.info(this.logTag, `sdk is in ${sdkPath}`);
    const appSourceSet = this.project.getAppSources(this.isIncludeTest);

    let systemApiRecognizer = new SystemApiRecognizer(this.projectName, this.project.getPath(), sdkPath);
    systemApiRecognizer.buildScene();
    Logger.info(this.logTag, `start scanning ${this.project.getPath()}`);
    appSourceSet.forEach((appCodeFilePath) => {
      if (this.debugFlag) {
        Logger.info(this.logTag, `scan ${appCodeFilePath}`);
      }
      systemApiRecognizer.recognize(appCodeFilePath);
    });
    Logger.info(this.logTag, `end scan ${this.project.getPath()}`);

    let sdk_version = this.project.getAppSdkVersion() ?? "14";
    let apiAnalyzer = new ApiAnalyzer(systemApiRecognizer.apiInfos, sdk_version);
    await apiAnalyzer.analyze();
    apiAnalyzer.analyzePermissionAbuse(this.project.getPermissionList());
    const apiWriter = this.getApiWriter();
    apiWriter.add(apiAnalyzer.getPermissionApiInfo(), apiAnalyzer.getPermissionInfo());
    await apiWriter.flush();
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


export class MultiProjectApiPermission {
  argv: CommandArgs;
  libPath?: string;
  isIncludeTest?: boolean;
  logTag = 'MultiProjectApiPermission';

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
      Logger.info('MultiProjectApiPermission', `project not found in ${this.argv.appDir}`);
      return;
    }
    const output = this.argv.output ?? this.argv.appDir!;
    const apiExcelWriter = new ApiExcelWriter(output, true);
    apiExcelWriter.close();
    allApps.forEach((app) => {
      if (app) {
        this.argv.appDir = app;
        const apiCollector = new ApiPermission(this.argv);
        // TODO: fix type error
        apiCollector.setApiWriter(<ApiWriter><unknown>apiExcelWriter);
        apiCollector.setLibPath(this.libPath!).setIncludeTest(this.isIncludeTest!).start();
      }
    });
    apiExcelWriter.open();
    await apiExcelWriter.flush();
  }
}

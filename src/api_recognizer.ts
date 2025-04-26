import {
    ArkClass,
    ArkFile,
    ArkMethod,
    FileSignature,
    LineColPosition,
    Scene,
    SceneConfig
} from "arkanalyzer";

export class SystemApiRecognizer {
    appName: string;
    appDir: string;
    sdkPath: string;
    scene = new Scene();
    apiInfos: ApiDeclarationInformation[] = [];
    apiInfoSet = new Set<string>();

    constructor(appName: string, appDir: string, sdkPath: string) {
        this.appName = appName;
        this.appDir = appDir;
        this.sdkPath = sdkPath;
    }

    buildScene() {
        let config: SceneConfig = new SceneConfig();
        config.buildConfig(this.appName, this.appDir, [{
            name: "etsSdk",
            path: this.sdkPath,
            moduleName: ""
        }])
        // console.log(this.appName, this.appDir, this.sdkPath);
        this.scene.buildBasicInfo(config);
        this.scene.buildScene4HarmonyProject();
        this.scene.collectProjectImportInfos();
        this.scene.inferTypes();
    }

    recognize(filePath: string) {
        const fileName = filePath.replace(this.scene.getRealProjectDir() + "/", "");
        const fromSignature = new FileSignature(this.scene.getProjectName(), fileName);
        const arkFile = this.scene.getFile(fromSignature);
        if (arkFile) {
            // this.recognizeFileImport(arkFile);
            for (const arkClass of arkFile.getClasses()) {
                // if (arkClass.getDecorators()) {
                //     this.recognizeDecorators(arkClass);
                // }
                this.recognizeClass(arkClass);
            }
        }
    }

    recognizeClass(arkClass: ArkClass) {
        for (const arkMethod of arkClass.getMethods()) {
            this.recognizeMethod(arkMethod);
        }
    }

    recognizeMethod(arkMethod: ArkMethod) {
        if (arkMethod.getName() == '_DEFAULT_ARK_METHOD') {
            return;
        }
        const cfg = arkMethod.getCfg();
        if (cfg == undefined) {
            return;
        }
        for (const stmt of cfg.getStmts()) {
            // 筛选出InvokeExpr
            if (stmt.containsInvokeExpr()) {
                const methodSignature = stmt.getInvokeExpr()!.getMethodSignature();
                let classSignature = methodSignature.getDeclaringClassSignature();
                let methodSubSignature = methodSignature.getMethodSubSignature();
                const apiInfo = new ApiDeclarationInformation();
                // 模块名
                const fileSignature = classSignature.getDeclaringFileSignature();
                // @ts-ignore
                const packageName = fileSignature?.getFileName()
                    ?? classSignature.getDeclaringNamespaceSignature()?.getDeclaringFileSignature()?.getFileName()
                    ?? "unknown";
                apiInfo.setPackageName(packageName);
                // 类名
                let className = classSignature.getClassName();
                if (className == "_DEFAULT_ARK_CLASS") {
                    // 替换成namespace名称
                    if (classSignature.getDeclaringNamespaceSignature()) {
                        className = classSignature.getDeclaringNamespaceSignature()!.getNamespaceName();
                    }
                }
                apiInfo.setTypeName(className);
                // 方法名
                apiInfo.setPropertyName(methodSubSignature.getMethodName());
                // 函数
                apiInfo.setApiRawText(methodSubSignature.toString());
                const methodCode = this.scene.getMethod(methodSignature)?.getCode();
                if (methodCode) {
                    apiInfo.setApiRawText(methodCode);
                }
                // 文件位置
                const sourceFileName = arkMethod.getDeclaringArkFile().getFilePath();
                apiInfo.setSourceFileName(sourceFileName);
                const pos = stmt.getOriginPositionInfo();
                apiInfo.setPosition(pos);
                // 添加api信息
                if(apiInfo.packageName !== "_UnknownFileName" && !apiInfo.packageName.endsWith("ets")) {
                    this.addApiInformation(apiInfo);
                }
            }
        }
    }

    formatApiInfo(apiInfo: ApiDeclarationInformation) {
        return `${apiInfo.dtsName}#${apiInfo.typeName}#${apiInfo.apiRawText}#${apiInfo.sourceFileName}#${apiInfo.pos}`;
    }

    addApiInformation(apiInfo: ApiDeclarationInformation) {
        if (this.apiInfoSet.has(this.formatApiInfo(apiInfo))) {
            return;
        }
        this.apiInfos.push(apiInfo);
        this.apiInfoSet.add(this.formatApiInfo(apiInfo));
    }

    getApiInformation() {
        return this.apiInfos ? this.apiInfos : [];
    }

    recognizeDecorators(node: ArkClass | ArkMethod) {
        const decorators = node.getDecorators();
        for (const decorator of decorators) {
            const decoratorName = decorator.getContent();
            // const symbol = this.typeChecker!.getSymbolAtLocation(decoratorName);
            console.log(decoratorName, decorator.getKind());
        }
    }

    recognizeFileImport(node: ArkFile) {
        const importInfos = node.getImportInfos();
        for (const importInfo of importInfos) {
            const importClauseName = importInfo.getImportClauseName();
            const from = importInfo.getFrom();
            console.log(importClauseName, from);
            console.log(importInfo.getTsSourceCode())
        }
    }
}

export class ApiDeclarationInformation {
    dtsName: string = '';
    packageName: string = '';
    propertyName: string = '';
    qualifiedTypeName: string = '';
    pos: string = '';
    sourceFileName: string = '';
    deprecated: string = '';
    apiRawText: string = '';
    typeName: string = '';
    componentName: string = '';
    apiType: string = '';
    dtsPath: string = '';
    apiText: string = '';
    apiPermission: string = '';

    setSdkFileName(fileName: string) {
        this.dtsName = fileName;
    }

    setPackageName(packageName: string) {
        this.packageName = packageName;
    }

    setPropertyName(propertyName: string) {
        this.propertyName = propertyName;
    }

    setQualifiedTypeName(typeName: string) {
        if (!this.qualifiedTypeName) {
            this.qualifiedTypeName = typeName;
        } else {
            this.qualifiedTypeName = `${typeName}.${this.qualifiedTypeName}`;
        }
    }

    setTypeName(typeName: string) {
        if (typeName && (!this.typeName || this.typeName === '')) {
            this.typeName = typeName;
        }
    }

    setPosition(pos: LineColPosition) {
        this.pos = `${pos.getLineNo()},${pos.getColNo()}`;
    }

    setSourceFileName(sourceFileName: string) {
        this.sourceFileName = sourceFileName;
    }

    /**
     * 设置废弃版本号
     * 
     * @param {string} deprecated 
     */
    setDeprecated(deprecated: string) {
        const regExpResult = deprecated.match(/\s*since\s*(\d)+.*/);
        const RESULT_LENGTH = 2;
        if (regExpResult !== null && regExpResult.length === RESULT_LENGTH) {
            this.deprecated = regExpResult[1];
        }
    }

    setApiRawText(apiRawText: string) {
        this.apiRawText = apiRawText;
    }
}
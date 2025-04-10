import { join } from "path";
import ts from "ohos-typescript";
import {
    SceneConfig,
    Scene,
    ArkInvokeStmt,
    ArkClass,
    ArkMethod,
    ArkFile,
    FileSignature,
    LineColPosition
} from "arkanalyzer";

export class SystemApiRecognizer {
    systemRoot: string;
    arkUIDecorator = new Set(['@Builder', '@Styles', '@Extend']);
    arkUIRender = new Set(['build']);
    forEachComponents = new Set(['LazyForEach', 'ForEach']);
    scene = new Scene();
    typeChecker?: ts.TypeChecker;
    apiInfos: ApiDeclarationInformation[] = [];
    apiInfoSet = new Set<string>();

    constructor(systemRoot: string) {
        this.systemRoot = systemRoot;
    }

    setTypeChecker(typeChecker: ts.TypeChecker) {
        this.typeChecker = typeChecker;
    }

    buildScene() {
        let config: SceneConfig = new SceneConfig();
        config.buildFromJson(join(__dirname, '../arkpermission_config.json'));
        this.scene.buildBasicInfo(config);
        this.scene.buildScene4HarmonyProject();
        this.scene.collectProjectImportInfos();
        this.scene.inferTypes();
    }

    recognize(sourceFile: ts.SourceFile, filePath: string) {
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
        const cfg = arkMethod.getCfg()!;
        if (cfg == undefined) {
            return;
        }
        for (const stmt of cfg.getStmts()) {
            // 筛选出ArkInvokeStmt
            if (stmt instanceof ArkInvokeStmt) {
                const methodSignature = stmt.getInvokeExpr().getMethodSignature();
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
                // 文件位置
                const sourceFileName = arkMethod.getDeclaringArkFile().getFilePath();
                apiInfo.setSourceFileName(sourceFileName);
                const pos = stmt.getOriginPositionInfo();
                apiInfo.setPosition(pos);
                // 添加api信息
                this.addApiInformation(apiInfo);
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

    getApiInformations() {
        const apiDecInfos = this.apiInfos ? this.apiInfos : [];
        // apiDecInfos.forEach((apiInfo) => {
        //   apiInfo.setApiNode(undefined);
        // });
        return apiDecInfos;
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
    qualifiedName: string = '';
    useInstead: string = '';
    typeName: string = '';
    componentName: string = '';
    apiNode: any = undefined;
    apiType: string = '';
    dtsPath: string = '';
    apiText: string = ''

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
        this.apiRawText = apiRawText.replace(/;/g, '');
    }

    setQualifiedName(qualifiedName: string) {
        this.qualifiedName = qualifiedName;
    }

    setUseInstead(useInstead: string) {
        this.useInstead = useInstead;
    }

    setComponentName(componentName: string) {
        this.componentName = componentName;
    }

    setApiNode(node: ts.Node) {
        this.apiNode = node;
    }

    setApiType(apiType: string) {
        this.apiType = apiType;
    }

    setDtsPath(dtsPath: string) {
        this.dtsPath = dtsPath;
    }

    setCompletedText(completedText: string) {
        this.apiText = completedText;
    }
}
import { FileSystem, Logger } from "./utils";
import { join } from "path";
import ts from "typescript";
import { SceneConfig, Scene, ArkInvokeStmt, ArkClass, ArkMethod } from "arkanalyzer";

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
        this.buildScene();
        for (const arkFile of this.scene.getFiles()) {
            // 打印导入信息
            console.log(arkFile.getFilePath());
            for (const importInfo of arkFile.getImportInfos()) {
                // console.log(importInfo.getImportClauseName(), importInfo.getFrom());
                console.log(importInfo)
            }
            for (const arkClass of arkFile.getClasses()) {
                if (arkClass.getDecorators()) {
                    this.recognizeDecorators(arkClass);
                }
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
                // console.log('nihao');
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

    setPosition(pos: ts.LineAndCharacter) {
        const { line, character } = pos;
        this.pos = `${line + 1},${character + 1}`;
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
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const recordCommand = vscode.commands.registerCommand('stackrecorder.recordDebugFrames', async () => {
        await startRecordingDebugFrames(context);
    });

    context.subscriptions.push(recordCommand);
}

export function deactivate() {
    
}

async function startRecordingDebugFrames(context: vscode.ExtensionContext) {
    const session = vscode.debug.activeDebugSession;
    if (!session) {
        vscode.window.showErrorMessage('No active debug session found.');
        return;
    }

    try {
        const debugData = await recordFramesAndVariables(session);
        await saveDataToJson(debugData, context);
    } catch (error) {
        vscode.window.showErrorMessage(`Error recording frames: ${error}`);
    }
}

async function recordFramesAndVariables(session: vscode.DebugSession) {
    const threads = await session.customRequest('threads');
    const debugData: any[] = [];
    for (const thread of threads.threads) {
        const stackFrames = await session.customRequest('stackTrace', { threadId: thread.id });
        for (const frame of stackFrames.stackFrames) {
            if (frame.source?.path === undefined) {
                continue;
            }
            const frameData: any = {
                name: frame.name,
                source: frame.source?.path || 'unknown',
                line: frame.line,
                variables: await recordVariables(session, frame.id)
            };
            debugData.push(frameData);
        }
    }

    return debugData;
}

async function recordVariables(session: vscode.DebugSession, frameId: number) {
    const scopes = await session.customRequest('scopes', { frameId });
    const variables: any[] = [];

    for (const scope of scopes.scopes) {
        const scopeVariables = await session.customRequest('variables', { variablesReference: scope.variablesReference });
        for (const variable of scopeVariables.variables) {
            variables.push({
                name: variable.name,
                value: variable.value,
                type: variable.type
            });
        }
    }

    return variables;
}

async function saveDataToJson(data: any, context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found to save the file.');
        return;
    }

    // Define the file path
    const filePath = path.join(workspaceFolders[0].uri.fsPath, 'debugData.json');

    // Write data to the file
    return new Promise<void>((resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                vscode.window.showErrorMessage(`Failed to save data: ${err.message}`);
                reject(err);
            } else {
                // vscode.window.showInformationMessage(`Debug data saved to ${filePath}`);
                resolve();
            }
        });
    });
}

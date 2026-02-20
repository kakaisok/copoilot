import { connect } from 'cloudflare:sockets';

const CONFIG = {
    uuid: '04c808e2-0b59-47b0-a54b-32fc7ef1c902',
    proxyIp: 'proxyip.cmliussss.net',
    subPath: '/sub',
    nodes: [
        {ip: '108.162.192.0', name: 'SG 新加坡', emoji: '🇸🇬'},
        {ip: '108.162.198.0', name: 'JP 日本', emoji: '🇯🇵'},
        {ip: '104.18.0.0', name: 'US 美国', emoji: '🇺🇸'},
        {ip: '104.26.0.0', name: 'DE 德国', emoji: '🇩🇪'},
        {ip: '188.114.96.0', name: 'NL 荷兰', emoji: '🇳🇱'}
    ]
};

export default {
    async fetch(request) {
        try {
            if (request.headers.get('Upgrade') === 'websocket') {
                return handleWebSocket(request);
            }
            return handleHTTP(request);
        } catch (error) {
            console.error('请求处理错误:', error);
            return new Response('服务器内部错误', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
    }
};

function handleWebSocket(request) {
    try {
        const url = new URL(request.url);
        let proxyIp = CONFIG.proxyIp;
        const ipParam = url.searchParams.get('ip');
        if (ipParam) {
            proxyIp = decodeURIComponent(ipParam);
        }
        const [clientSocket, serverSocket] = Object.values(new WebSocketPair());
        serverSocket.accept();
        handleTransport(serverSocket, proxyIp);
        return new Response(null, { status: 101, webSocket: clientSocket });
    } catch (error) {
        console.error('WebSocket 处理错误:', error);
        return new Response('WebSocket 连接失败', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}

function handleHTTP(request) {
    try {
        const url = new URL(request.url);
        if (url.pathname === CONFIG.subPath) {
            return generateNodeInfo(url.hostname);
        }
        return new Response('未找到请求的资源。访问 /sub 查看节点信息。', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    } catch (error) {
        console.error('HTTP 处理错误:', error);
        return new Response('请求处理失败', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
}

function generateNodeInfo(deployDomain) {
    const baseUrl = `vless://${CONFIG.uuid}@`;
    const params = `?encryption=none&security=tls&sni=${deployDomain}&fp=random&type=ws&host=${deployDomain}&path=pyip%3D${CONFIG.proxyIp}`;
    const defaultNode = `${baseUrl}${deployDomain}:443${params}#${deployDomain}`;
    const nodesStr = CONFIG.nodes.map(node => `${baseUrl}${node.ip}:443${params}#${node.emoji}${node.name}`).join('\n');
    const content = `部署成功！✨\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 部署信息\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 UUID: ${CONFIG.uuid}\n🌐 部署域名: ${deployDomain}\n🔀 反代 IP: ${CONFIG.proxyIp}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 默认节点\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${defaultNode}\n\n${nodesStr}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 使用说明\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. 使用手搓 CF 节点生成器生成更多节点：\n   https://sub.cndyw.ggff.net/\n\n2. 将上方链接导入到 v2ray 或 Karing 中\n\n3. 更多节点请访问：\n   http://ip.cloudip.ggff.net\n\n⚠️ 安全提示：\n   - 强烈建议修改默认 UUID\n   - 不要在公开环境中暴露真实服务信息\n   - 定期检查日志和流量使用情况\n`;    
    return new Response(content, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
}

async function handleTransport(wsSocket, proxyIp) {
    let tcpSocket = null;
    let tcpWriter = null;
    let tcpReader = null;
    let firstPacketProcessed = false;
    let firstPacketPromise = null;
    let writeQueue = Promise.resolve();
    const addToQueue = (fn) => {
        writeQueue = writeQueue.then(fn).catch(error => {
            console.error('队列执行错误:', error);
            throw error;
        });
        return writeQueue;
    };
    try {
        wsSocket.addEventListener('message', async event => {
            try {
                if (!firstPacketProcessed) {
                    firstPacketProcessed = true;
                    firstPacketPromise = processFirstPacket(event.data, proxyIp);
                    await addToQueue(() => firstPacketPromise);
                } else {
                    await firstPacketPromise;
                    await addToQueue(() => sendToTCP(event.data));
                }
            } catch (error) {
                console.error('消息处理错误:', error);
                closeConnections(tcpSocket, wsSocket, 1000, '数据处理失败');
            }
        });
        wsSocket.addEventListener('close', () => {
            closeConnections(tcpSocket, wsSocket);
        });
        wsSocket.addEventListener('error', (error) => {
            console.error('WebSocket 错误:', error);
            closeConnections(tcpSocket, wsSocket);
        });

        async function processFirstPacket(data) {
            try {
                const binaryData = new Uint8Array(data);
                const protocolVersion = binaryData[0];
                const uuid = extractUUID(binaryData.slice(1, 17));
                if (uuid !== CONFIG.uuid) {
                    throw new Error(`UUID 验证失败。期望: ${CONFIG.uuid}, 收到: ${uuid}`);
                }
                const cmdLength = binaryData[17];
                const portIndex = 18 + cmdLength + 1;
                const port = new DataView(binaryData.buffer, portIndex, 2).getUint16(0);
                const addressTypeIndex = portIndex + 2;
                const addressType = binaryData[addressTypeIndex];
                let addressLength = 0;
                let address = '';
                let addressInfoIndex = addressTypeIndex + 1;
                switch (addressType) {
                    case 1:
                        addressLength = 4;
                        address = Array.from(binaryData.slice(addressInfoIndex, addressInfoIndex + addressLength)).join('.');
                        break;
                    case 2:
                        addressLength = binaryData[addressInfoIndex];
                        addressInfoIndex += 1;
                        address = new TextDecoder().decode(binaryData.slice(addressInfoIndex, addressInfoIndex + addressLength));
                        break;
                    case 3:
                        addressLength = 16;
                        const ipv6Parts = [];
                        const dataView = new DataView(binaryData.buffer, addressInfoIndex, 16);
                        for (let i = 0; i < 8; i++) {
                            ipv6Parts.push(dataView.getUint16(i * 2).toString(16));
                        }
                        address = `[${ipv6Parts.join(':')}]`;
                        break;
                    default:
                        throw new Error(`无效的地址类型: ${addressType}`);
                }
                console.log(`连接信息 - 地址: ${address}, 端口: ${port}`);
                try {
                    tcpSocket = connect({ hostname: address, port });
                    await tcpSocket.opened;
                    console.log('直连成功');
                } catch (error) {
                    console.warn('直连失败，尝试使用反代:', error.message);
                    if (!proxyIp) {
                        throw new Error('直连失败且未配置反代 IP');
                    }
                    const [proxyHost, proxyPort = 443] = proxyIp.split(':');
                    tcpSocket = connect({ hostname: proxyHost, port: Number(proxyPort) });
                    await tcpSocket.opened;
                    console.log(`反代连接成功: ${proxyHost}:${proxyPort}`);
                }
                tcpWriter = tcpSocket.writable.getWriter();
                tcpReader = tcpSocket.readable.getReader();
                const payloadData = binaryData.slice(addressInfoIndex + addressLength);
                if (payloadData.length > 0) {
                    await tcpWriter.write(payloadData);
                }
                wsSocket.send(new Uint8Array([protocolVersion, 0]));
                startReverseTransport();
            } catch (error) {
                console.error('首包处理失败:', error);
                closeConnections(tcpSocket, wsSocket, 1000, error.message);
                throw error;
            }
        }

        async function sendToTCP(data) {
            if (!tcpWriter) {
                throw new Error('TCP 连接未建立');
            }
            await tcpWriter.write(new Uint8Array(data));
        }

        async function startReverseTransport() {
            try {
                while (true) {
                    const { done, value } = await tcpReader.read();
                    if (value && value.length > 0) {
                        try {
                            await addToQueue(() => {
                                if (wsSocket.readyState === WebSocket.OPEN) {
                                    wsSocket.send(value);
                                }
                            });
                        } catch (error) {
                            console.error('WebSocket 发送失败:', error);
                            break;
                        }
                    }
                    if (done) {
                        console.log('TCP 连接已关闭');
                        break;
                    }
                }
            } catch (error) {
                console.error('反向传输错误:', error);
            } finally {
                closeConnections(tcpSocket, wsSocket);
            }
        }
    } catch (error) {
        console.error('传输处理错误:', error);
        closeConnections(tcpSocket, wsSocket);
    }
}

function extractUUID(bytes) {
    const hexString = Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return hexString.replace( /(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5' );
}

async function closeConnections(tcpSocket, wsSocket, code = 1000, reason = '连接已关闭') {
    try {
        if (tcpSocket) {
            try { await tcpSocket.close(); } catch (e) { }
        }
    } catch (error) {
        console.warn('关闭 TCP 连接时出错:', error);
    }
    try {
        if (wsSocket && wsSocket.readyState === WebSocket.OPEN) {
            wsSocket.close(code, reason);
        }
    } catch (error) {
        console.warn('关闭 WebSocket 时出错:', error);
    }
}

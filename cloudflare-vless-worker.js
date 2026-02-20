import { connect } from 'cloudflare:sockets';

/**
 * VLESS 代理 - Cloudflare Workers 版本
 * 功能：通过 WebSocket 实现 VLESS 协议的 TCP 流量转发
 * 默认 UUID：04c808e2-0b59-47b0-a54b-32fc7ef1c902
 * 推荐通过 Cloudflare Pages 部署
 */

// ============ 配置区域 ============
const CONFIG = {
  // 你的 VLESS UUID，强烈建议修改
  uuid: '04c808e2-0b59-47b0-a54b-32fc7ef1c902',
  
  // 默认反代 IP，可通过 URL 参数动态修改
  proxyIp: 'proxyip.cmliussss.net',
  
  // 节点信息显示路径
  subPath: '/sub',
  
  // 预定义的节点列表
  nodes: [
    { ip: '108.162.192.0', name: 'SG 新加坡', emoji: '🇸🇬' },
    { ip: '108.162.198.0', name: 'JP 日本', emoji: '🇯🇵' },
    { ip: '104.18.0.0', name: 'US 美国', emoji: '🇺🇸' },
    { ip: '104.26.0.0', name: 'DE 德国', emoji: '🇩🇪' },
    { ip: '188.114.96.0', name: 'NL 荷兰', emoji: '🇳🇱' }
  ]
};

// ============ 主处理函数 ============
export default {
  async fetch(request) {
    try {
      if (request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocket(request);
      }
      return handleHTTP(request);
    } catch (error) {
      console.error('请求处理错误:', error);
      return new Response('服务器内部错误', {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};

// ============ WebSocket 处理 ============
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

// ============ HTTP 处理 ============
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

// ============ 节点信息生成 ============
function generateNodeInfo(deployDomain) {
  const baseUrl = `vless://${CONFIG.uuid}@`;
  const params = `?encryption=none&security=tls&sni=${deployDomain}&fp=random&type=ws&host=${deployDomain}&path=pyip%3D${CONFIG.proxyIp}`;
  const defaultNode = `${baseUrl}${deployDomain}:443${params}#${deployDomain}`;
  const nodesStr = CONFIG.nodes.map(node => `${baseUrl}${node.ip}:443${params}#${node.emoji}${node.name}`).join('\n');
  
  const content = `部署成功！✨\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 部署信息\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔑 UUID: ${CONFIG.uuid}\n🌐 部署域名: ${deployDomain}\n🔀 反代 IP: ${CONFIG.proxyIp}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚀 默认节点\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${defaultNode}\n\n${nodesStr}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 使用说明\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1. 使用手搓 CF 节点生成器生成更多节点：\n   https://sub.cndyw.ggff.net/\n\n2. 将上方链接导入到 v2ray 或 Karing 中\n\n3. 更多节点请访问：\n   http://ip.cloudip.ggff.net\n\n⚠️ 安全提示：\n   - 强烈建议修改默认 UUID\n   - 不要在公开环境中暴露真实服务信息\n   - 定期检查日志和流量使用情况\n`;

  return new Response(content, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' } });
}

// ============ 核心传输处理 ============
asyn...
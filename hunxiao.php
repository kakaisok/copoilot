<?php
/**
 * 高级 JavaScript 混淆器 (PHP 完整版)
 * 特性：密钥异或加密、Base64 编码池、反美化检测、动态解密、自执行封装
 */

set_time_limit(0); // 防止大文件处理超时
ini_set('memory_limit', '512M'); // 提高内存上限以处理 156KB+ 文件

class JSAdvancedObfuscator {
    private $key;
    private $stringPool = [];
    private $dictionary = [];

    public function __construct($key) {
        $this->key = $key ?: 'gemini_security_default';
    }

    /**
     * XOR 加密 + Base64 编码
     */
    private function xorEncrypt($data) {
        $key = $this->key;
        $res = '';
        for ($i = 0; $i < strlen($data); $i++) {
            $res .= chr(ord($data[$i]) ^ ord($key[$i % strlen($key)]));
        }
        return base64_encode($res);
    }

    /**
     * 混淆主逻辑
     */
    public function obfuscate($code) {
        // 1. 去除单行注释（减少体积，防止干扰正则）
        $code = preg_replace('/\/\/.*/', '', $code);
        
        // 2. 提取所有字符串并建立索引池
        // 匹配单引号和双引号内的内容
        $code = preg_replace_callback('/([\'"])(.*?)\1/', function($matches) {
            $content = $matches[2];
            // 过滤掉太短或已经是解密函数的字符串
            if (strlen($content) < 2 || strpos($content, '_0x') !== false) {
                return $matches[0];
            }

            if (!isset($this->dictionary[$content])) {
                $idx = count($this->stringPool);
                $this->stringPool[] = $this->xorEncrypt($content);
                $this->dictionary[$content] = $idx;
            }
            return "_0x_dec(" . $this->dictionary[$content] . ")";
        }, $code);

        $jsonPool = json_encode($this->stringPool);
        $b64Key = base64_encode($this->key);

        // 3. 构建 JS 运行时外壳 (包含反调试检测)
        $obfuscated = $this->assembleShell($code, $jsonPool, $b64Key);
        
        return $obfuscated;
    }

    private function assembleShell($payload, $pool, $key) {
        // 生成随机解密函数名，增加破解难度
        $fnName = '_0x' . bin2hex(random_bytes(3));
        
        // 这里采用模板，注入反美化逻辑
        // 如果代码被格式化（增加空格或换行），正则表达式测试 toString 将失败
        return "(function(_0x_arr, _0x_key) {
    var _0x_k = atob(_0x_key);
    var $fnName = function(_0x_idx) {
        var _0x_data = atob(_0x_arr[_0x_idx]);
        var _0x_res = '';
        for (var i = 0; i < _0x_data.length; i++) {
            _0x_res += String.fromCharCode(_0x_data.charCodeAt(i) ^ _0x_k.charCodeAt(i % _0x_k.length));
        }
        return _0x_res;
    };
    window._0x_dec = $fnName;

    // --- 反调试与反美化逻辑 ---
    (function() {
        var _0x_check = function() {
            var _0x_t = function() {
                var _0x_r = new RegExp('\\\\w+ \\\\(\\\\).+?{.+?}\\\\s?');
                return _0x_r.test(_0x_t.toString());
            };
            if (!_0x_t()) {
                // 如果检测到代码被美化，则进入死循环
                while (true) { console.log('Debugger detected or code tampered!'); }
            }
        };
        _0x_check();
    })();

    // --- 原始代码逻辑 ---
    (function(){
        " . $payload . "
    })();
})($pool, '$key');";
    }
}

// 界面响应逻辑
$output = '';
$source = $_POST['code'] ?? '';
$key = $_POST['key'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($source)) {
    $obfuscator = new JSAdvancedObfuscator($key);
    $output = $obfuscator->obfuscate($source);
}
?>

<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>专业版 JS 代码混淆控制台</title>
    <style>
        body { background: #0f0f0f; color: #00ff00; font-family: 'Courier New', monospace; margin: 0; padding: 20px; }
        .wrapper { max-width: 1000px; margin: 0 auto; border: 1px solid #00ff00; padding: 20px; box-shadow: 0 0 15px rgba(0,255,0,0.2); }
        h1 { text-align: center; border-bottom: 1px solid #00ff00; padding-bottom: 10px; }
        textarea { width: 100%; height: 300px; background: #000; color: #00ff00; border: 1px solid #00ff00; padding: 10px; box-sizing: border-box; resize: vertical; }
        .config { margin: 20px 0; display: flex; gap: 20px; align-items: center; }
        input[type="text"] { background: #000; border: 1px solid #00ff00; color: #00ff00; padding: 8px; flex: 1; }
        button { background: #00ff00; color: #000; border: none; padding: 10px 30px; font-weight: bold; cursor: pointer; transition: 0.3s; }
        button:hover { background: #008800; color: #fff; }
        .output-box { margin-top: 20px; background: #1a1a1a; }
        .stats { font-size: 12px; color: #888; margin-top: 5px; }
    </style>
</head>
<body>

<div class="wrapper">
    <h1>&lt; JS_PROTECTOR_V1.0 /&gt;</h1>
    
    <form method="post">
        <p>// 请粘贴原始 JavaScript 代码 (支持大文件):</p>
        <textarea name="code" placeholder="输入代码..."><?php echo htmlspecialchars($source); ?></textarea>
        
        <div class="config">
            <label>ENCRYPTION_KEY:</label>
            <input type="text" name="key" value="<?php echo htmlspecialchars($key ?: 'SECRET_'.rand(1000,9999)); ?>">
            <button type="submit">执行混淆编译</button>
        </div>
    </form>

    <?php if ($output): ?>
    <div class="output-box">
        <p>// 混淆后的安全代码 (体积: <?php echo round(strlen($output)/1024, 2); ?> KB):</p>
        <textarea readonly id="result"><?php echo htmlspecialchars($output); ?></textarea>
        <button onclick="copyCode()" style="margin-top:10px;">复制代码内容</button>
    </div>
    <?php endif; ?>
</div>

<script>
function copyCode() {
    var copyText = document.getElementById("result");
    copyText.select();
    document.execCommand("copy");
    alert("已复制到剪贴板！");
}
</script>

</body>
</html>

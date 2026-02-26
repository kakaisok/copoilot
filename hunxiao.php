<?php
/**
 * 高级 JS 混淆器 - 带反调试与密钥保护
 */

class AdvancedObfuscator {
    private $key;
    private $strings = [];

    public function __construct($key) {
        $this->key = $key;
    }

    private function encrypt($data) {
        $res = '';
        for ($i = 0; $i < strlen($data); $i++) {
            $res .= chr(ord($data[$i]) ^ ord($this->key[$i % strlen($this->key)]));
        }
        return bin2hex($res);
    }

    public function obfuscate($code) {
        // 1. 提取并加密所有字符串
        $code = preg_replace_callback('/([\'"])(.*?)\1/', function($m) {
            $idx = count($this->strings);
            $this->strings[] = $this->encrypt($m[2]);
            return "_0x_getStr($idx)";
        }, $code);

        $hexData = json_encode($this->strings);
        $keyBase64 = base64_encode($this->key);

        // 2. 核心混淆模板：包含反美化检测
        $obfuscated = <<<JS
(function() {
    // 反美化检测逻辑：如果代码被格式化（多了换行/空格），则进入卡死状态
    var _0x_check = function() {
        var _0x_test = function() {
            var _0x_regex = new RegExp('\\\\w+ \\\\(\\\\).+?{.+?}\\\\s?');
            return _0x_regex.test(_0x_test.toString());
        };
        if (!_0x_test()) {
            while (true) { /* 代码被篡改，触发死循环自毁 */ }
        }
    };
    _0x_check();

    var _0x_data = $hexData;
    var _0x_k = atob('$keyBase64');

    window._0x_getStr = function(i) {
        var h = _0x_data[i], s = '', r = '';
        for (var m = 0; m < h.length; m += 2) {
            s += String.fromCharCode(parseInt(h.substr(m, 2), 16));
        }
        for (var n = 0; n < s.length; n++) {
            r += String.fromCharCode(s.charCodeAt(n) ^ _0x_k.charCodeAt(n % _0x_k.length));
        }
        return r;
    };

    // 原始逻辑开始
    $code
})();
JS;
        return $obfuscated;
    }
}

// 简单的 UI 处理
$output = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $obf = new AdvancedObfuscator($_POST['key'] ?: 'root');
    $output = $obf->obfuscate($_POST['code']);
}
?>

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Pro JS Obfuscator</title>
    <style>
        body { background: #1e1e1e; color: #d4d4d4; font-family: 'Segoe UI', sans-serif; padding: 40px; }
        .box { max-width: 800px; margin: 0 auto; background: #252526; padding: 20px; border-radius: 5px; border: 1px solid #333; }
        textarea { width: 100%; height: 150px; background: #1e1e1e; color: #9cdcfe; border: 1px solid #444; padding: 10px; box-sizing: border-box; }
        input { background: #333; color: #fff; border: 1px solid #555; padding: 8px; width: 200px; }
        button { background: #0e639c; color: #fff; border: none; padding: 10px 20px; cursor: pointer; }
        button:hover { background: #1177bb; }
        pre { background: #000; padding: 15px; overflow-x: auto; color: #b5cea8; border-left: 3px solid #0e639c; }
    </style>
</head>
<body>
    <div class="box">
        <h2>JS 高级加固混淆器 (带密钥)</h2>
        <form method="post">
            <p>1. 输入 JS 代码:</p>
            <textarea name="code" required>console.log("Welcome to Security system");</textarea>
            <p>2. 设置解密密钥 (不可丢失):</p>
            <input type="text" name="key" value="MySecretKey">
            <button type="submit">生成加固代码</button>
        </form>

        <?php if($output): ?>
            <p>3. 混淆后的结果:</p>
            <textarea readonly><?php echo htmlspecialchars($output); ?></textarea>
            <p><small style="color: #ce9178;">注意：如果尝试在 Chrome 控制台右键 "Format" 此代码，它将由于反美化机制而无法运行。</small></p>
        <?php endif; ?>
    </div>
</body>
</html>

# serve.ps1 - Servidor de Desenvolvimento em PowerShell
# Usado para hospedar a SPA e permitir carregamento de módulos ES (CORS) localmente.

$port = 3000
$url = "http://localhost:$port/"
$currentDir = Get-Location

# Verifica se a porta já está em uso para evitar travamentos
$portActive = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($portActive) {
    # Se a porta 3000 estiver ocupada, tenta 3001, 3002...
    do {
        $port++
        $url = "http://localhost:$port/"
        $portActive = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    } while ($portActive)
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
} catch {
    Write-Error "Falha ao iniciar o servidor: $_"
    Exit
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  Mamma Mia - Sistema de Controle de Consumo de Água" -ForegroundColor Yellow
Write-Host "  Servidor local ativo em: $url" -ForegroundColor Green
Write-Host "  Para encerrar o servidor, pressione Ctrl+C" -ForegroundColor DarkGray
Write-Host "==================================================`n" -ForegroundColor Cyan

# Abre o navegador automaticamente no endereço local
Start-Process $url

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/" -or $path -eq "") {
            $path = "/index.html"
        }

        # Resolve o caminho do arquivo físico local de forma segura
        $cleanPath = $path.Replace("/", "\").TrimStart("\")
        $filePath = Join-Path $currentDir $cleanPath

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Mapeamento de MIME Type correto para evitar erros no navegador
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }

            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            
            # Adiciona cabeçalhos CORS simples e Cache Control para desenvolvimento
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errorMsg = [System.Text.Encoding]::UTF8.GetBytes("Arquivo nao encontrado: $path")
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $errorMsg.Length
            $response.OutputStream.Write($errorMsg, 0, $errorMsg.Length)
        }
        $response.Close()
    } catch {
        # Captura erros de requisições canceladas ou conexões fechadas abruptamente pelo cliente
    }
}

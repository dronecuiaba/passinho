param([string]$Repository = 'dronecuiaba/passinho')
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Repositório inválido.' }
$projectRoot = [IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$pagesCheckout = [IO.Path]::GetFullPath((Join-Path $projectRoot 'work/pages'))
if (-not $pagesCheckout.StartsWith((Join-Path $projectRoot 'work') + [IO.Path]::DirectorySeparatorChar)) { throw 'Diretório de publicação inválido.' }
Push-Location $projectRoot
try {
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'A compilação falhou.' }
    New-Item -ItemType Directory -Force -Path $pagesCheckout | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $pagesCheckout '.git'))) {
        git -C $pagesCheckout init -b gh-pages
        git -C $pagesCheckout remote add origin "https://github.com/$Repository.git"
    }
    # This directory is an isolated generated checkout; retain its Git history.
    foreach ($item in Get-ChildItem -Force -LiteralPath $pagesCheckout) {
        $resolvedItem = [IO.Path]::GetFullPath($item.FullName)
        if ($item.Name -ne '.git' -and $resolvedItem.StartsWith($pagesCheckout + [IO.Path]::DirectorySeparatorChar)) {
            Remove-Item -LiteralPath $resolvedItem -Recurse -Force
        }
    }
    foreach ($item in Get-ChildItem -Force -LiteralPath (Join-Path $projectRoot 'dist')) {
        Copy-Item -LiteralPath $item.FullName -Destination $pagesCheckout -Recurse -Force
    }
    [IO.File]::WriteAllText((Join-Path $pagesCheckout '.nojekyll'), '')
    git -C $pagesCheckout add .
    $pagesChanges = git -C $pagesCheckout status --porcelain
    if ($pagesChanges) {
        git -C $pagesCheckout commit -m 'Publish Passinho web build'
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao salvar a publicação.' }
    }
    git -C $pagesCheckout push -u origin gh-pages
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao enviar a publicação.' }
} finally { Pop-Location }

$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    $taskOutput = [IO.Path]::GetFullPath((Join-Path (Get-Location) '../../outputs'))
    New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
    $env:PASSINHO_PACKAGE_ROOT = (Get-Location).Path
    $env:PASSINHO_PACKAGE_OUTPUT = $taskOutput
    @'
from pathlib import Path
import os,zipfile
root=Path(os.environ['PASSINHO_PACKAGE_ROOT'])
output=Path(os.environ['PASSINHO_PACKAGE_OUTPUT'])/'Passinho-codigo-fonte-v1.0.0.zip'
exclude={'.gradle','build','.git','.idea','signing','node_modules'}
files=[]
for p in root.rglob('*'):
    rel=p.relative_to(root)
    if not p.is_file() or any(part in exclude for part in rel.parts):continue
    if p.name=='local.properties' or p.suffix in {'.p12','.jks','.keystore','.log'}:continue
    if rel.parts[0]=='tools' and p.suffix=='.jar':continue
    files.append((p,rel))
with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED) as z:
    for p,rel in sorted(files):z.write(p,'Passinho/'+rel.as_posix())
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
    names=z.namelist()
    assert 'Passinho/app/src/main/java/br/com/rotina/Engine.java' in names
    assert 'Passinho/gradle/wrapper/gradle-wrapper.jar' in names
    assert not any('preview-family' in n or 'password.txt' in n or n.endswith('local.properties') for n in names)
print(f'Source package verified: {len(files)} files, {output.stat().st_size} bytes.')
'@ | python -
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao empacotar o código-fonte.' }
} finally {
    Remove-Item Env:\PASSINHO_PACKAGE_ROOT,Env:\PASSINHO_PACKAGE_OUTPUT -ErrorAction SilentlyContinue
    Pop-Location
}

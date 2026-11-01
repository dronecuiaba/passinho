$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    if (-not (Test-Path tools/openjson-1.0.13.jar)) {
        Invoke-WebRequest -Uri 'https://repo.maven.apache.org/maven2/com/github/openjson/openjson/1.0.13/openjson-1.0.13.jar' -OutFile tools/openjson-1.0.13.jar
    }
    New-Item -ItemType Directory -Force build/qa | Out-Null
    javac -encoding UTF-8 -cp tools/openjson-1.0.13.jar -d build/qa app/src/main/java/br/com/rotina/Engine.java tests/EngineTest.java tools/Preview.java
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compilar os testes.' }
    java -cp 'build/qa;tools/openjson-1.0.13.jar' EngineTest
    if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes.' }
} finally { Pop-Location }


$ErrorActionPreference = "Stop"

$Registry = "REPLACE WITH KUBERNETES IP:32000"

$Projects = @(
    @{
        Name = "frontend"
        Image = "jamsa-frontend"
        Tag = "1.0"
    },
    @{
        Name = "backend"
        Image = "jamsa-backend"
        Tag = "1.0"
    }
)

foreach ($Project in $Projects) {

    $Image = "$Registry/$($Project.Image):$($Project.Tag)"
    $Directory = Join-Path $PSScriptRoot $Project.Name

    Write-Host "`nBuilding $Image..." -ForegroundColor Cyan

    docker build --no-cache -t $Image $Directory

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to build $Image"
    }

    Write-Host "Pushing $Image..." -ForegroundColor Cyan

    docker push $Image

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to push $Image"
    }

    Write-Host "$Image pushed successfully!" -ForegroundColor Green
}

Write-Host "`nAll images built and pushed successfully!" -ForegroundColor Green
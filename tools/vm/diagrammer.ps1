# PowerPoint makes a presentation with charts of test numbers, one on each
# slide, and the file is then shown on the screen for the host to read
# (tools/windows-vm.py read). tests/real-charts.test.ts says what Lysark is
# to make of each slide; change the two together.
#
# Put this folder on the CD image and type, in the Run dialog of the VM:
#   powershell -ep bypass -file d:\diagrammer.ps1
# It takes about three minutes. PowerPoint and the sheet of each chart show
# on the VM's screen meanwhile. An empty Excel window may be left open
# afterwards; close it.
$dir = Join-Path $env:USERPROFILE 'lysark-test\diagram'
if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
New-Item -ItemType Directory -Force $dir | Out-Null
$log = Join-Path $dir 'log.txt'
function Log($t) { Add-Content -Path $log -Value $t; Write-Host $t }
function Col($n) { [string][char](64 + $n) }

function Chart($type, $name, $cells, $after) {
  try {
    $slide = $script:pres.Slides.Add($script:pres.Slides.Count + 1, 12)
    $shape = $slide.Shapes.AddChart2(-1, $type, 60, 60, 620, 380)
    Start-Sleep -Seconds 4
    $chart = $shape.Chart
    # A new chart opens its sheet of numbers; it must be closed before the next chart.
    try { $chart.ChartData.Activate() } catch { }
    Start-Sleep -Seconds 2
    $wb = $chart.ChartData.Workbook
    for ($try = 0; $null -eq $wb -and $try -lt 10; $try++) {
      Start-Sleep -Seconds 2
      try { $chart.ChartData.Activate() } catch { }
      $wb = $chart.ChartData.Workbook
    }
    if ($cells) {
      $ws = $wb.Worksheets.Item(1)
      $rows = $cells.Count
      $cols = $cells[0].Count
      $ws.ListObjects.Item(1).Resize($ws.Range('A1:' + (Col $cols) + $rows))
      # All the cells in one go: set one at a time, PowerShell holds on to
      # the type of the first value and refuses the next kind.
      $grid = New-Object 'object[,]' 8, 8
      for ($r = 0; $r -lt $rows; $r++) {
        for ($c = 0; $c -lt $cols; $c++) { $grid[$r, $c] = $cells[$r][$c] }
      }
      $ws.Range('A1:H8').Value2 = $grid
      $sheet = "='" + $ws.Name + "'!"
      $chart.SetSourceData($sheet + '$A$1:$' + (Col $cols) + '$' + $rows, 2)
      Start-Sleep -Seconds 1
      if (($type -eq 4 -or $type -eq 65) -and $cells[1][0] -is [int]) {
        # Numbers in the first column: PowerPoint has taken them for a series.
        # They are what stands along the axis, as when a lecturer writes
        # numbers (years, say) in the first column of the sheet.
        $chart.SeriesCollection(1).Delete() | Out-Null
        for ($i = 1; $i -le $chart.SeriesCollection().Count; $i++) {
          $chart.SeriesCollection($i).XValues = $sheet + '$A$2:$A$' + $rows
        }
        Start-Sleep -Seconds 1
      }
    }
    $wb.Close()
    Start-Sleep -Seconds 1
    if ($after) { & $after $chart }
    Log ("OK   slide " + $slide.SlideIndex + ": " + $name)
  } catch {
    Log ("FEIL " + $name + ": " + $_.Exception.Message)
  }
}

$titles = {
  param($c)
  $c.HasTitle = $true
  $c.ChartTitle.Text = 'Diagram A'
  $x = $c.Axes(1)
  $x.HasTitle = $true
  $x.AxisTitle.Text = 'Akse X'
  $y = $c.Axes(2)
  $y.HasTitle = $true
  $y.AxisTitle.Text = 'Akse Y'
}
$names = @( @(' ', 'Serie A', 'Serie B'), @('A', 1, 3), @('B', 2.5, -1), @('C', $null, 4) )
$plain = @( @(' ', 'Serie A', 'Serie B'), @('A', 1, 3), @('B', 2, 1), @('C', 3, 4) )
$numbered = @( @(' ', 'Serie A', 'Serie B'), @(0, 0, 4), @(1, 2, $null), @(4, 4, 3) )
$points = @( @('X', 'Serie A', 'Serie B'), @(0, 1, 3), @(2, 2, 2), @(4, 3, 1) )

try {
  $ppt = New-Object -ComObject PowerPoint.Application
  Log ("PowerPoint " + $ppt.Version + " build " + $ppt.Build)
  $script:pres = $ppt.Presentations.Add(-1)
  Chart 51 'standing bars as PowerPoint makes them, untouched' $null $null
  Chart 51 'standing bars, two series, a hole, a negative number, titles, highest 10' $names {
    param($c)
    & $titles $c
    $c.Axes(2).MaximumScale = 10
  }
  Chart 65 'line with names along the axis' $plain $null
  Chart 4 'line with numbers along the axis, a hole' $numbered $null
  Chart 65 'line with markers and numbers along the axis' $numbered $titles
  Chart 74 'points with straight lines, titles, x from 0 to 8' $points {
    param($c)
    & $titles $c
    $c.Axes(1).MinimumScale = 0
    $c.Axes(1).MaximumScale = 8
  }
  Chart 75 'points with straight lines and no markers' $points $null
  Chart 72 'points with smooth lines' $points $null
  Chart -4169 'points without lines' $points $null
  Chart 52 'stacked bars' $plain $null
  Chart 57 'lying bars' $plain $null
  Chart 5 'pie' @( @(' ', 'Serie A'), @('A', 1), @('B', 2), @('C', 3) ) $null
  Chart 1 'area' $plain $null
  $script:pres.SaveAs((Join-Path $dir 'diagram.pptx'))
  Log 'saved'
  $script:pres.Close()
  $ppt.Quit()
} catch {
  Log ("FEIL: " + $_.Exception.Message)
}
Compress-Archive -Path (Join-Path $dir '*') -DestinationPath (Join-Path $env:TEMP 'lysark-ut.zip') -Force
& (Join-Path $PSScriptRoot 'ut.ps1') (Join-Path $env:TEMP 'lysark-ut.zip')

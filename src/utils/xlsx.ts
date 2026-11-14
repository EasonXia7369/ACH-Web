import type ExcelJS from 'exceljs'

function styleCell(cell: ExcelJS.Cell, s?: number) {
  if (s === 1) {
    cell.font = { bold: true, size: 11, name: '微软雅黑' }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FB' } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD5DCEA' } },
      bottom: { style: 'thin', color: { argb: 'FFD5DCEA' } },
      left: { style: 'thin', color: { argb: 'FFD5DCEA' } },
      right: { style: 'thin', color: { argb: 'FFD5DCEA' } },
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  } else if (s === 3) {
    cell.font = { size: 10, color: { argb: 'FF6B7280' }, name: '微软雅黑' }
  } else {
    cell.font = { size: 11, name: '微软雅黑' }
  }
}

type CellValue = string | number | { v: string | number }

/**
 * 导出多 sheet xlsx。
 * ExcelJS 按需动态加载：只在真正点导出时才下载这个较大的依赖，不影响首屏。
 */
export async function exportXlsx(
  filename: string,
  sheets: Array<{
    name: string
    header: string[]
    rows: CellValue[][]
    widths?: number[]
    freeze?: number
  }>,
): Promise<void> {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  wb.creator = '班级中心'
  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name, {
      views: spec.freeze ? [{ state: 'frozen', ySplit: spec.freeze }] : undefined,
    })
    if (spec.widths?.length) {
      ws.columns = spec.widths.map((w) => ({ width: w }))
    }
    const headerRow = ws.addRow(spec.header)
    headerRow.eachCell((cell) => styleCell(cell, 1))
    headerRow.height = 20
    for (const row of spec.rows) {
      const r = ws.addRow(row.map((c) => (typeof c === 'object' ? c.v : c)))
      r.height = 18
      r.eachCell((cell) => styleCell(cell))
    }
  }
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
    a.remove()
  }, 3000)
}

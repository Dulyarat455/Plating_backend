const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();

const ExcelJS = require('exceljs');


module.exports = {

  list: async (req, res) => {
    try {
      const chunkSize = 500;
  
      const allBoxes = [];
      let lastId = null;
  
      // =============================
      // 1) Box + HeaderIssue
      // =============================
      while (true) {
        const chunk = await prisma.box.findMany({
          where: {
            status: 'use',
            ...(lastId ? { id: { lt: lastId } } : {}),
          },
          orderBy: { id: 'desc' },
          take: chunkSize,
          include: {
            HeaderIssue: {
              select: {
                issueLotNo: true,
                sentDate: true,
                sentDateByUser: true,        // ✅ NEW (issueShipment)
  
                shift: true,
                vender: true,
                controlLot: true,
  
                Group: {
                  select: { name: true },
                },
  
                User: {
                  select: {
                    empNo: true,
                    name: true,
                  },
                },
              },
            },
          },
        });
  
        if (!chunk.length) break;
  
        allBoxes.push(...chunk);
        lastId = chunk[chunk.length - 1].id;
  
        if (chunk.length < chunkSize) break;
      }
  
      if (!allBoxes.length) return res.json([]);
  
      // =============================
      // 2) HeaderReceive
      // =============================
      const receiveIds = [
        ...new Set(
          allBoxes
            .map(b => b.receiveId)
            .filter(Boolean)
            .map(Number)
        ),
      ];
  
      const receiveMap = new Map();
  
      for (let i = 0; i < receiveIds.length; i += chunkSize) {
        const chunk = receiveIds.slice(i, i + chunkSize);
  
        const receives = await prisma.headerReceive.findMany({
          where: { id: { in: chunk } },
          select: {
            id: true,
            receiveLotNo: true,
            receiveDate: true,
            receiveDateByUser: true,      // ✅ NEW (receiveShipment)
            shift: true,
            controlLot: true,

            User: {
              select: {
                empNo: true,
                name: true,
              },
            },
          },
        });
  
        for (const r of receives) receiveMap.set(r.id, r);
      }
  
      // =============================
      // 3) map rows
      // =============================
      const rows = allBoxes.map(b => {
        const issue = b.HeaderIssue;
        const receive = b.receiveId ? receiveMap.get(b.receiveId) : null;
  
        return {
          id: b.id,
          issueId: b.issueId,
          receiveId: b.receiveId,
  
          issueDate: issue?.sentDate ?? null,
          receiveDate: receive?.receiveDate ?? null,
  
          issueShipment: issue?.sentDateByUser ?? null,          // ✅ NEW
          receiveShipment: receive?.receiveDateByUser ?? null,  // ✅ NEW
  
          issueNo: issue?.issueLotNo ?? null,
          ReceiveNo: receive?.receiveLotNo ?? null,
  
          groupName: issue?.Group?.name ?? null,
  
          vender: issue?.vender ?? null,
          controlLot: issue?.controlLot ?? null,
          controlLotR: receive?.controlLot ?? null,   // ✅ เพิ่มตรงนี้
  
          issueByEmpNo: issue?.User?.empNo ?? null,
          issueByName: issue?.User?.name ?? null,
          shiftIssue: issue?.shift ?? null,
  
          receiveByEmpNo: receive?.User?.empNo ?? null,
          receiveByName: receive?.User?.name ?? null,
          shiftReceive: receive?.shift ?? null,
  
          itemNo: b.itemNo,
          itemName: b.itemName,
          wosNo: b.wosNo,
          dwg: b.dwg,
          dieNo: b.dieNo,
          lotNo: b.lotNo,
          qty: b.qty,
          BoxState: b.BoxState,
          status: b.status,
        };
      });
  
      return res.json(rows);
  
    } catch (e) {
      return res.status(500).send({ error: e.message });
    }
  },


  exportExcel: async (req, res) => {
    try {
      const ExcelJS = require('exceljs');
  
      const chunkSize = 500;
      const { filters } = req.body || {};
  
      const norm = (v) => (v ?? '').toString().trim();
      const normLower = (v) => norm(v).toLowerCase();
  
      const {
        itemNo,
        itemName,
        boxState,
        vendor,
        controlLot,
        issueNo,
        receiveNo,
        groupName,
  
        // ✅ new shipment ranges
        issueShipDateFrom,
        issueShipDateTo,
        receiveShipDateFrom,
        receiveShipDateTo,
      } = filters || {};
  
      const formatTime = (d) => {
        if (!d) return '';
        const x = new Date(d);
        if (isNaN(x.getTime())) return '';
        return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}:${String(
          x.getSeconds()
        ).padStart(2, '0')}`;
      };
  
      const formatDateDMY = (d) => {
        if (!d) return '';
        const x = new Date(d);
        if (isNaN(x.getTime())) return '';
        const dd = String(x.getDate()).padStart(2, '0');
        const mm = String(x.getMonth() + 1).padStart(2, '0');
        const yyyy = x.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };
  
      const startOfDayMs = (ymd) => {
        if (!ymd) return null;
        const [y, m, d] = String(ymd).split('-').map(Number);
        const t = new Date(y, m - 1, d, 0, 0, 0, 0);
        const ms = t.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
      
      const endOfDayMs = (ymd) => {
        if (!ymd) return null;
        const [y, m, d] = String(ymd).split('-').map(Number);
        const t = new Date(y, m - 1, d, 23, 59, 59, 999);
        const ms = t.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
  
      // ✅ shipment ranges
      const issueShipFromMs = startOfDayMs(issueShipDateFrom);
      const issueShipToMs = endOfDayMs(issueShipDateTo);
      const receiveShipFromMs = startOfDayMs(receiveShipDateFrom);
      const receiveShipToMs = endOfDayMs(receiveShipDateTo);
  
      let lastId = null;
      const allRows = [];
  
      while (true) {
        const boxes = await prisma.box.findMany({
          where: {
            status: 'use',
            ...(lastId ? { id: { lt: lastId } } : {}),
          },
          include: {
            HeaderIssue: {
              include: {
                User: true,
                Group: { select: { name: true } },
              },
            },
          },
          orderBy: { id: 'desc' },
          take: chunkSize,
        });
  
        if (!boxes.length) break;
        lastId = boxes[boxes.length - 1].id;
  
        const receiveIds = [...new Set(boxes.map((b) => b.receiveId).filter(Boolean))];
  
        const receives = receiveIds.length
          ? await prisma.headerReceive.findMany({
              where: { id: { in: receiveIds } },
              include: { User: true },
            })
          : [];
  
        const recvMap = new Map(receives.map((r) => [r.id, r]));
  
        const issueUserIds = boxes.map((b) => b.HeaderIssue?.userId).filter(Boolean);
        const recvUserIds = receives.map((r) => r.userId).filter(Boolean);
        const userIds = [...new Set([...issueUserIds, ...recvUserIds])];
  
        const userSectionMap = new Map();
  
        if (userIds.length) {
          const maps = await prisma.mapGroupSection.findMany({
            where: {
              status: 'use',
              userId: { in: userIds },
            },
            orderBy: { id: 'asc' },
            select: {
              userId: true,
              Section: { select: { name: true } },
            },
          });
  
          for (const m of maps) {
            if (!userSectionMap.has(m.userId)) {
              userSectionMap.set(m.userId, m.Section?.name ?? '');
            }
          }
        }
  
        for (const b of boxes) {
          const issue = b.HeaderIssue;
          const recv = b.receiveId ? recvMap.get(b.receiveId) : null;
  
          const shipI = issue?.sentDateByUser ?? null;
          const shipR = recv?.receiveDateByUser ?? null;
  
          const shipIMs = shipI ? new Date(shipI).getTime() : null;
          const shipRMs = shipR ? new Date(shipR).getTime() : null;
  
          const issueSection = issue?.userId ? (userSectionMap.get(issue.userId) ?? '') : '';
          const receiveSection = recv?.userId ? (userSectionMap.get(recv.userId) ?? '') : '';
  
          const row = {
            itemNo: b.itemNo,
            itemName: b.itemName,
            wosNo: b.wosNo,
            dwg: b.dwg ?? '',
            dieNo: b.dieNo,
            lotNo: b.lotNo,
            qty: b.qty,
  
            controlLot: issue?.controlLot ?? '',
            vendor: issue?.vender ?? '',
            group: issue?.Group?.name ?? '',
  
            issueNo: issue?.issueLotNo ?? '',
            issueDate: formatDateDMY(issue?.sentDate),
            timeIssue: formatTime(issue?.sentDate),
            issueBy: issue?.User?.name ?? '',
            issueEmpNo: issue?.User?.empNo ?? '',
            shiftIssue: issue?.shift ?? '',
            issueSection: issueSection,
  
            shipmentDateI: formatDateDMY(shipI),
            shipmentTimeI: formatTime(shipI),
  
            receiveNo: recv?.receiveLotNo ?? '',
            receiveDate: formatDateDMY(recv?.receiveDate),
            timeReceive: formatTime(recv?.receiveDate),
            receiveBy: recv?.User?.name ?? '',
            receiveEmpNo: recv?.User?.empNo ?? '',
            shiftReceive: recv?.shift ?? '',
            receiveSection: receiveSection,
            
            // ✅ NEW
            controlLotR: recv?.controlLot ?? '',

            shipmentDateR: formatDateDMY(shipR),
            shipmentTimeR: formatTime(shipR),
  
            boxState: b.BoxState ?? '',
          };
  
          if (itemNo && row.itemNo !== itemNo) continue;
          if (itemName && row.itemName !== itemName) continue;
          if (vendor && row.vendor !== vendor) continue;
          if (controlLot && row.controlLot !== controlLot) continue;
          if (groupName && row.group !== groupName) continue;
          if (issueNo && row.issueNo !== issueNo) continue;
          if (receiveNo && row.receiveNo !== receiveNo) continue;
          if (boxState && normLower(row.boxState) !== normLower(boxState)) continue;
  
          // ✅ ShipmentDate(I) range
          if (issueShipFromMs != null) {
            if (shipIMs == null || shipIMs < issueShipFromMs) continue;
          }
          if (issueShipToMs != null) {
            if (shipIMs == null || shipIMs > issueShipToMs) continue;
          }
  
          // ✅ ShipmentDate(R) range
          if (receiveShipFromMs != null) {
            if (shipRMs == null || shipRMs < receiveShipFromMs) continue;
          }
          if (receiveShipToMs != null) {
            if (shipRMs == null || shipRMs > receiveShipToMs) continue;
          }
  
          allRows.push(row);
        }
  
        if (boxes.length < chunkSize) break;
      }
  
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Report');
  
      ws.columns = [
        { header: 'ItemNo', key: 'itemNo', width: 16 },
        { header: 'ItemName', key: 'itemName', width: 26 },
        { header: 'WosNo', key: 'wosNo', width: 18 },
        { header: 'DWG', key: 'dwg', width: 18 },
        { header: 'DIENo', key: 'dieNo', width: 12 },
        { header: 'LotNo', key: 'lotNo', width: 18 },
        { header: 'Qty', key: 'qty', width: 10 },
  
        { header: 'ControlLot', key: 'controlLot', width: 16 },
        { header: 'Vendor', key: 'vendor', width: 16 },
        { header: 'Group', key: 'group', width: 16 },
  
        { header: 'IssueNo', key: 'issueNo', width: 16 },
        { header: 'IssueDate', key: 'issueDate', width: 12 },
        { header: 'TimeIssue', key: 'timeIssue', width: 12 },
        { header: 'ShipmentDate(I)', key: 'shipmentDateI', width: 14 },
        { header: 'ShipmentTime(I)', key: 'shipmentTimeI', width: 14 },
        { header: 'IssueBy', key: 'issueBy', width: 22 },
        { header: 'IssueEmpNo', key: 'issueEmpNo', width: 14 },
        { header: 'Shift(I)', key: 'shiftIssue', width: 10 },
        { header: 'IssueSection', key: 'issueSection', width: 16 },
  
        { header: 'ReceiveNo', key: 'receiveNo', width: 16 },
        { header: 'ControlLot(R)', key: 'controlLotR', width: 16 },
        { header: 'ReceiveDate', key: 'receiveDate', width: 12 },
        { header: 'TimeReceive', key: 'timeReceive', width: 12 },
        { header: 'ShipmentDate(R)', key: 'shipmentDateR', width: 14 },
        { header: 'ShipmentTime(R)', key: 'shipmentTimeR', width: 14 },
        { header: 'ReceiveBy', key: 'receiveBy', width: 22 },
        { header: 'ReceiveEmpNo', key: 'receiveEmpNo', width: 14 },
        { header: 'Shift(R)', key: 'shiftReceive', width: 10 },
        { header: 'ReceiveSection', key: 'receiveSection', width: 16 },
  
        { header: 'BoxState', key: 'boxState', width: 12 },
      ];
  
      ws.getRow(1).font = { bold: true };
      for (const r of allRows) ws.addRow(r);
  
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Report.xlsx"`);
  
      await wb.xlsx.write(res);
      return res.end();
    } catch (e) {
      return res.status(500).send({ error: e.message });
    }
  },



  // printTestPdf: async (req, res) => {
  //   let browser;
  
  //   try {
  //     const html = `
  // <!DOCTYPE html>
  // <html>
  // <head>
  //   <meta charset="UTF-8" />
  //   <style>
  //     @page {
  //       size: A4 landscape;
  //       margin: 8mm;
  //     }
  
  //     * {
  //       box-sizing: border-box;
  //     }
  
  //     body {
  //       font-family: Arial, "TH Sarabun New", sans-serif;
  //       margin: 0;
  //       color: #333;
  //       font-size: 11px;
  //     }
  
  //     .page {
  //       width: 100%;
  //       min-height: 190mm;
  //       position: relative;
  //     }
  
  //     .top {
  //       display: grid;
  //       grid-template-columns: 1fr 2fr 1fr;
  //       align-items: start;
  //       margin-bottom: 14px;
  //     }
  
  //     .title {
  //       text-align: center;
  //       font-weight: bold;
  //       line-height: 1.45;
  //     }
  
  //     .title .company {
  //       font-size: 23px;
  //     }
  
  //     .title .thai {
  //       font-size: 17px;
  //     }
  
  //     .title .eng {
  //       font-size: 17px;
  //     }
  
  //     .title .division {
  //       font-size: 16px;
  //       margin-top: 6px;
  //     }
  
  //     .form-no {
  //       text-align: right;
  //       line-height: 2.3;
  //       font-size: 12px;
  //       padding-top: 8px;
  //     }
  
  //     .header-grid {
  //       display: grid;
  //       grid-template-columns: 2.1fr 1.6fr 2fr 0.9fr 2.2fr;
  //       gap: 26px;
  //       align-items: start;
  //       margin-bottom: 16px;
  //     }
  
  //     table {
  //       border-collapse: collapse;
  //       width: 100%;
  //     }
  
  //     .box-table td,
  //     .box-table th {
  //       border: 1px solid #444;
  //       height: 34px;
  //       text-align: center;
  //       vertical-align: middle;
  //     }
  
  //     .box-table th {
  //       font-weight: normal;
  //     }
  
  //     .check-table td {
  //       border: 1px solid #444;
  //       height: 26px;
  //       padding: 2px 8px;
  //     }
  
  //     .check-box {
  //       display: inline-block;
  //       width: 22px;
  //       height: 20px;
  //       border: 1px solid #444;
  //       margin-right: 22px;
  //       vertical-align: middle;
  //     }
  
  //     .right-info {
  //       line-height: 3.3;
  //       font-size: 12px;
  //       white-space: nowrap;
  //     }
  
  //     .dot {
  //       display: inline-block;
  //       border-bottom: 1px dotted #555;
  //       width: 165px;
  //       height: 12px;
  //     }
  
  //     .main-table th,
  //     .main-table td {
  //       border: 1px solid #444;
  //       text-align: center;
  //       vertical-align: middle;
  //     }
  
  //     .main-table th {
  //       height: 34px;
  //       font-weight: normal;
  //       line-height: 1.35;
  //       font-size: 10px;
  //     }
  
  //     .main-table td {
  //       height: 26px;
  //     }
  
  //     .main-table .no { width: 34px; }
  //     .main-table .po { width: 78px; }
  //     .main-table .qty { width: 58px; }
  //     .main-table .partno { width: 112px; }
  //     .main-table .desc { width: 122px; }
  //     .main-table .qtyout { width: 58px; }
  //     .main-table .unit { width: 50px; }
  //     .main-table .totalunit { width: 88px; }
  //     .main-table .sample { width: 38px; }
  //     .main-table .sign { width: 86px; }
  
  //     .footer {
  //       display: grid;
  //       grid-template-columns: 1fr 1fr;
  //       margin-top: 10px;
  //       font-size: 12px;
  //     }
  
  //     .note {
  //       line-height: 1.8;
  //     }
  
  //     .approve {
  //       justify-self: end;
  //       width: 310px;
  //       line-height: 2.4;
  //     }
  
  //     .small {
  //       font-size: 10px;
  //     }
  
  //     .code {
  //       position: absolute;
  //       right: 0;
  //       bottom: 0;
  //       font-size: 9px;
  //     }
  //   </style>
  // </head>
  
  // <body>
  //   <div class="page">
  
  //     <div class="top">
  //       <div></div>
  
  //       <div class="title">
  //         <div class="company">NMB-Minebea Thai Ltd.</div>
  //         <div class="thai">ใบผ่านงาน HOME WORK (ขาออก)</div>
  //         <div class="eng">HOME WORK GATE PASS (OUT)</div>
  //         <div class="division">DIVISION........................................</div>
  //       </div>
  
  //       <div class="form-no">
  //         <div>แบบฟอร์มที่&nbsp;&nbsp; 1</div>
  //         <div>FROM&nbsp;&nbsp; 1</div>
  //       </div>
  //     </div>
  
  //     <div class="header-grid">
  //       <table class="box-table">
  //         <tr>
  //           <th>ชื่อเวนเดอร์<br>VENDOR NAME</th>
  //           <th>เลขที่เวนเดอร์<br>VENDOR CODE</th>
  //         </tr>
  //         <tr>
  //           <td></td>
  //           <td></td>
  //         </tr>
  //       </table>
  
  //       <table class="check-table">
  //         <tr><td><span class="check-box"></span>OVER ISSUED</td></tr>
  //         <tr><td><span class="check-box"></span>NG TO REWORK</td></tr>
  //         <tr><td><span class="check-box"></span>NIGHT SHIFT</td></tr>
  //       </table>
  
  //       <table class="box-table">
  //         <tr>
  //           <th>รหัสสินค้า<br>ITEM NAME</th>
  //           <th>เลขที่สินค้า<br>ITEM NO</th>
  //         </tr>
  //         <tr>
  //           <td></td>
  //           <td></td>
  //         </tr>
  //       </table>
  
  //       <table class="box-table">
  //         <tr>
  //           <th>เลขที่รุ่น<br>MODEL NO</th>
  //         </tr>
  //         <tr>
  //           <td></td>
  //         </tr>
  //       </table>
  
  //       <div class="right-info">
  //         <div>เลขที่ (NO)&nbsp;&nbsp;<span class="dot"></span></div>
  //         <div>วันที่ (DATE)&nbsp;&nbsp;<span class="dot"></span></div>
  //         <div>เวลา (TIME)&nbsp;&nbsp;<span class="dot"></span></div>
  //       </div>
  //     </div>
  
  //     <table class="main-table">
  //       <thead>
  //         <tr>
  //           <th rowspan="2" class="no">ลำดับที่<br>NO.</th>
  //           <th rowspan="2" class="po">เลขที่ P/O<br>P/O NO</th>
  //           <th rowspan="2" class="qty">จำนวน<br>QTY</th>
  //           <th rowspan="2" class="partno">เลขที่ชิ้นงาน<br>PART NO</th>
  //           <th rowspan="2" class="desc">ชื่องาน/รายละเอียด<br>PART NAME/<br>DESCRIPTION</th>
  //           <th rowspan="2" class="qtyout">จำนวนส่งออก<br>QTY (OUT)</th>
  //           <th rowspan="2" class="unit">หน่วยนับ<br>UNIT</th>
  //           <th rowspan="2" class="totalunit">จำนวนภาชนะบรรจุ<br>TOTAL UNIT</th>
  //           <th colspan="8">จำนวนสุ่มตรวจ (RANDOM SAMPLING CHECK)</th>
  //           <th rowspan="2" class="sign">ส่งโดยฝ่ายผลิต<br>SENT BY<br>PRODUCTION</th>
  //           <th rowspan="2" class="sign">รับโดยเวนเดอร์<br>RECEIVED BY<br>VENDOR</th>
  //           <th rowspan="2" class="sign">ตรวจสอบสินค้าโดย รปภ<br>CHECKED BY<br>GUARDMAN</th>
  //         </tr>
  //         <tr>
  //           <th class="sample">1</th>
  //           <th class="sample">2</th>
  //           <th class="sample">3</th>
  //           <th class="sample">4</th>
  //           <th class="sample">5</th>
  //           <th class="sample">6</th>
  //           <th class="sample">7</th>
  //           <th class="sample">8</th>
  //         </tr>
  //       </thead>
  
  //       <tbody>
  //         ${Array.from({ length: 13 }).map(() => `
  //           <tr>
  //             ${Array.from({ length: 19 }).map(() => `<td></td>`).join('')}
  //           </tr>
  //         `).join('')}
  //       </tbody>
  //     </table>
  
  //     <div class="footer">
  //       <div class="note">
  //         <div>ต้นฉบับ &nbsp;&nbsp;&nbsp;&nbsp; : ฝ่ายบัญชี</div>
  //         <div>ORIGINAL &nbsp;&nbsp; : ACCOUNT DIVISION</div>
  //         <div>หมายเหตุ &nbsp;&nbsp;&nbsp;&nbsp; : 1. ห้ามทำการลบ,ขีด,ฆ่า ข้อมูลใด ๆทั้งสิ้น</div>
  //         <div class="small">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;NOT ALLOW TO DELETE OR CORRECT ANY DATA</div>
  //       </div>
  
  //       <div class="approve">
  //         <div>อนุมัติโดย &nbsp;&nbsp; : ....................................................</div>
  //         <div>APPROVED BY (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
  //         <div>วันที่ (DATE)&nbsp; : ....................................................</div>
  //       </div>
  //     </div>
  
  //     <div class="code">M2-4239A4</div>
  //   </div>
  // </body>
  // </html>
  //     `;
  
  //     browser = await puppeteer.launch({
  //       headless: true,
  //       args: ['--no-sandbox', '--disable-setuid-sandbox'],
  //     });
  
  //     const page = await browser.newPage();
  
  //     await page.setContent(html, {
  //       waitUntil: 'networkidle0',
  //     });
  
  //     const pdfBuffer = await page.pdf({
  //       format: 'A4',
  //       landscape: true,
  //       printBackground: true,
  //       preferCSSPageSize: true,
  //       scale: 0.92,
  //       margin: {
  //         top: '8mm',
  //         right: '8mm',
  //         bottom: '8mm',
  //         left: '8mm',
  //       },
  //     });
  
  //     res.setHeader('Content-Type', 'application/pdf');
  //     res.setHeader('Content-Disposition', 'inline; filename="HomeWorkGatePass-Test.pdf"');
  //     return res.send(pdfBuffer);
  
  //   } catch (e) {
  //     return res.status(500).send({ error: e.message });
  //   } finally {
  //     if (browser) await browser.close();
  //   }
  // }
  



  printTestPdf: async (req, res) => {
    let browser;
  
    try {
      const { default: puppeteer } = await import('puppeteer');
  
      const chunkSize = 500;
      const { filters } = req.body || {};
  
      const norm = (v) => (v ?? '').toString().trim();
      const normLower = (v) => norm(v).toLowerCase();
  
      const {
        itemNo,
        itemName,
        boxState,
        vendor,
        controlLot,
        issueNo,
        receiveNo,
        groupName,
        issueShipDateFrom,
        issueShipDateTo,
        receiveShipDateFrom,
        receiveShipDateTo,
      } = filters || {};
  
      const escapeHtml = (v) => {
        return (v ?? '')
          .toString()
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
  
      const formatNumber = (v) => {
        const n = Number(v || 0);
        if (!Number.isFinite(n)) return '';
        return n.toLocaleString('en-US');
      };
  
      const startOfDayMs = (ymd) => {
        if (!ymd) return null;
        const [y, m, d] = String(ymd).split('-').map(Number);
        const t = new Date(y, m - 1, d, 0, 0, 0, 0);
        const ms = t.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
  
      const endOfDayMs = (ymd) => {
        if (!ymd) return null;
        const [y, m, d] = String(ymd).split('-').map(Number);
        const t = new Date(y, m - 1, d, 23, 59, 59, 999);
        const ms = t.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
  
      const formatDateDDMMYYYY = (ymd) => {
        if (!ymd) return '';
        const [y, m, d] = String(ymd).split('-');
        return `${d}-${m}-${y}`;
      };
  
      const issueShipFromMs = startOfDayMs(issueShipDateFrom);
      const issueShipToMs = endOfDayMs(issueShipDateTo);
      const receiveShipFromMs = startOfDayMs(receiveShipDateFrom);
      const receiveShipToMs = endOfDayMs(receiveShipDateTo);
  
      let lastId = null;
      const groupMap = new Map();
  
      while (true) {
        const boxes = await prisma.box.findMany({
          where: {
            status: 'use',
            ...(lastId ? { id: { lt: lastId } } : {}),
          },
          include: {
            HeaderIssue: {
              include: {
                User: true,
                Group: { select: { name: true } },
              },
            },
          },
          orderBy: { id: 'desc' },
          take: chunkSize,
        });
  
        if (!boxes.length) break;
        lastId = boxes[boxes.length - 1].id;
  
        const receiveIds = [
          ...new Set(boxes.map((b) => b.receiveId).filter(Boolean)),
        ];
  
        const receives = receiveIds.length
          ? await prisma.headerReceive.findMany({
              where: { id: { in: receiveIds } },
              include: { User: true },
            })
          : [];
  
        const recvMap = new Map(receives.map((r) => [r.id, r]));
  
        for (const b of boxes) {
          const issue = b.HeaderIssue;
          const recv = b.receiveId ? recvMap.get(b.receiveId) : null;
  
          const shipI = issue?.sentDateByUser ?? null;
          const shipR = recv?.receiveDateByUser ?? null;
  
          const shipIMs = shipI ? new Date(shipI).getTime() : null;
          const shipRMs = shipR ? new Date(shipR).getTime() : null;
  
          const row = {
            itemNo: b.itemNo ?? '',
            itemName: b.itemName ?? '',
            dieNo: b.dieNo ?? '',
            qty: Number(b.qty || 0),
  
            vendor: issue?.vender ?? '',
            controlLot: issue?.controlLot ?? '',
            group: issue?.Group?.name ?? '',
            issueNo: issue?.issueLotNo ?? '',
            receiveNo: recv?.receiveLotNo ?? '',
            boxState: b.BoxState ?? '',
          };
  
          if (itemNo && row.itemNo !== itemNo) continue;
          if (itemName && row.itemName !== itemName) continue;
          if (vendor && row.vendor !== vendor) continue;
          if (controlLot && row.controlLot !== controlLot) continue;
          if (groupName && row.group !== groupName) continue;
          if (issueNo && row.issueNo !== issueNo) continue;
          if (receiveNo && row.receiveNo !== receiveNo) continue;
          if (boxState && normLower(row.boxState) !== normLower(boxState)) continue;
  
          if (issueShipFromMs != null) {
            if (shipIMs == null || shipIMs < issueShipFromMs) continue;
          }
  
          if (issueShipToMs != null) {
            if (shipIMs == null || shipIMs > issueShipToMs) continue;
          }
  
          if (receiveShipFromMs != null) {
            if (shipRMs == null || shipRMs < receiveShipFromMs) continue;
          }
  
          if (receiveShipToMs != null) {
            if (shipRMs == null || shipRMs > receiveShipToMs) continue;
          }
  
          const key = `${row.itemNo}||${row.itemName}||${row.dieNo}`;
  
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              itemNo: row.itemNo,
              itemName: row.itemName,
              dieNo: row.dieNo,
              qty: 0,
              totalUnit: 0,
            });
          }
  
          const g = groupMap.get(key);
          g.qty += row.qty;
          g.totalUnit += 1;
        }
  
        if (boxes.length < chunkSize) break;
      }
  
      const printRows = Array.from(groupMap.values())
      .sort((a, b) => {
        // เรียง ItemName ก่อน
        const byName = a.itemName.localeCompare(b.itemName);
    
        if (byName !== 0) return byName;
    
        // ItemName เหมือนกัน เรียง ItemNo
        const byItemNo = a.itemNo.localeCompare(b.itemNo);
    
        if (byItemNo !== 0) return byItemNo;
    
        // ItemNo เหมือนกัน เรียง DieNo
        return a.dieNo.localeCompare(b.dieNo);
      })
      .map((x, index) => ({
        no: index + 1,
        poNo: x.dieNo,
        partNo: x.itemNo,
        partName: x.itemName,
        qtyOut: x.qty,
        unit: 'PCS',
        totalUnit: `${x.totalUnit} BOX`,
      }));
  
      const maxRows = 13;
  
      const tableRowsHtml = Array.from({ length: maxRows }).map((_, i) => {
        const r = printRows[i];
  
        return `
          <tr>
            <td>${r ? escapeHtml(r.no) : ''}</td>
            <td>${r ? escapeHtml(r.poNo) : ''}</td>
            <td></td>
            <td>${r ? escapeHtml(r.partNo) : ''}</td>
            <td>${r ? escapeHtml(r.partName) : ''}</td>
            <td>${r ? escapeHtml(formatNumber(r.qtyOut)) : ''}</td>
            <td>${r ? escapeHtml(r.unit) : ''}</td>
            <td>${r ? escapeHtml(r.totalUnit) : ''}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      }).join('');
  
      const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      @page {
        size: A4 landscape;
        margin: 8mm;
      }
  
      * {
        box-sizing: border-box;
      }
  
      body {
        font-family: Arial, "TH Sarabun New", sans-serif;
        margin: 0;
        color: #333;
        font-size: 11px;
      }
  
      .page {
        width: 100%;
        min-height: 190mm;
        position: relative;
      }
  
      .top {
        display: grid;
        grid-template-columns: 1fr 2fr 1fr;
        align-items: start;
        margin-bottom: 14px;
      }
  
      .title {
        text-align: center;
        font-weight: bold;
        line-height: 1.45;
      }
  
      .title .company {
        font-size: 23px;
      }
  
      .title .thai {
        font-size: 20px;
      }
  
      .title .eng {
        font-size: 17px;
      }
  
      .title .division {
        font-size: 16px;
        margin-top: 6px;
      }
  
      .form-no {
        text-align: right;
        line-height: 2.3;
        font-size: 12px;
        padding-top: 8px;
      }
  
      .header-grid {
        display: grid;
        grid-template-columns: 2.1fr 1.6fr 2fr 0.9fr 2.2fr;
        gap: 26px;
        align-items: start;
        margin-bottom: 16px;
      }
  
      table {
        border-collapse: collapse;
        width: 100%;
      }
  
      .box-table td,
      .box-table th {
        border: 1px solid #444;
        height: 34px;
        text-align: center;
        vertical-align: middle;
      }
  
      .box-table th {
        font-weight: normal;
        font-size: 13px;
      }
  
      .check-table td {
        border: 1px solid #444;
        height: 26px;
        padding: 2px 8px;
      }
  
      .check-box {
        display: inline-block;
        width: 22px;
        height: 20px;
        border: 1px solid #444;
        margin-right: 22px;
        vertical-align: middle;
      }
  
      .right-info {
        line-height: 3.3;
        font-size: 13px;
        white-space: nowrap;
      }
  
      .dot {
        display: inline-block;
        border-bottom: 1px dotted #555;
        width: 165px;
        height: 18px;
        line-height: 18px;
        text-align: center;
      }
  
      .main-table th,
      .main-table td {
        border: 1px solid #444;
        text-align: center;
        vertical-align: middle;
      }
  
      .main-table th {
        height: 34px;
        font-weight: normal;
        line-height: 1.35;
        font-size: 11px;
      }
  
      .main-table td {
        height: 26px;
        padding: 1px 3px;
        font-size: 10px;
        word-break: break-word;
      }
  
      .main-table .no { width: 34px; }
      .main-table .po { width: 78px; }
      .main-table .qty { width: 58px; }
      .main-table .partno { width: 112px; }
      .main-table .desc { width: 122px; }
      .main-table .qtyout { width: 58px; }
      .main-table .unit { width: 50px; }
      .main-table .totalunit { width: 88px; }
      .main-table .sample { width: 38px; }
      .main-table .sign { width: 86px; }
  
      .footer {
        display: grid;
        grid-template-columns: 1fr 1fr;
        margin-top: 10px;
        font-size: 13px;
      }
  
      .note {
        line-height: 1.8;
      }
  
      .approve {
        justify-self: end;
        width: 310px;
        line-height: 2.4;
      }
  
      .small {
        font-size: 10px;
      }
  
      .code {
        position: absolute;
        right: 0;
        bottom: 0;
        font-size: 9px;
      }
    </style>
  </head>
  
  <body>
    <div class="page">
  
      <div class="top">
        <div></div>
  
        <div class="title">
          <div class="company">NMB-Minebea Thai Ltd.</div>
          <div class="thai">ใบผ่านงาน HOME WORK (ขาออก)</div>
          <div class="eng">HOME WORK GATE PASS (OUT)</div>
          <div class="division">DIVISION................PRESS...................</div>
        </div>
  
        <div class="form-no">
          <div>แบบฟอร์มที่&nbsp;&nbsp; 1</div>
          <div>FROM&nbsp;&nbsp; 1</div>
        </div>
      </div>
  
      <div class="header-grid">
        <table class="box-table">
          <tr>
            <th>ชื่อเวนเดอร์<br>VENDOR NAME</th>
            <th>เลขที่เวนเดอร์<br>VENDOR CODE</th>
          </tr>
          <tr>
            <td>${escapeHtml(vendor || '')}</td>
            <td></td>
          </tr>
        </table>
  
        <table class="check-table">
          <tr><td><span class="check-box"></span>OVER ISSUED</td></tr>
          <tr><td><span class="check-box"></span>NG TO REWORK</td></tr>
          <tr><td><span class="check-box"></span>NIGHT SHIFT</td></tr>
        </table>
  
        <table class="box-table">
          <tr>
            <th>รหัสสินค้า<br>ITEM NAME</th>
            <th>เลขที่สินค้า<br>ITEM NO</th>
          </tr>
          <tr>
            <td></td>
            <td></td>
          </tr>
        </table>
  
        <table class="box-table">
          <tr>
            <th>เลขที่รุ่น<br>MODEL NO</th>
          </tr>
          <tr>
            <td></td>
          </tr>
        </table>
  
        <div class="right-info">
          <div>เลขที่ (NO)&nbsp;&nbsp;<span class="dot"></span></div>
          <div>วันที่ (DATE)&nbsp;&nbsp;<span class="dot">${formatDateDDMMYYYY(issueShipDateFrom)}</span></div>
          <div>เวลา (TIME)&nbsp;&nbsp;<span class="dot"></span></div>
        </div>
      </div>
  
      <table class="main-table">
        <thead>
          <tr>
            <th rowspan="2" class="no">ลำดับที่<br>NO.</th>
            <th rowspan="2" class="po">เลขที่ P/O<br>P/O NO</th>
            <th rowspan="2" class="qty">จำนวน<br>QTY</th>
            <th rowspan="2" class="partno">เลขที่ชิ้นงาน<br>PART NO</th>
            <th rowspan="2" class="desc">ชื่องาน/รายละเอียด<br>PART NAME/<br>DESCRIPTION</th>
            <th rowspan="2" class="qtyout">จำนวนส่งออก<br>QTY (OUT)</th>
            <th rowspan="2" class="unit">หน่วยนับ<br>UNIT</th>
            <th rowspan="2" class="totalunit">จำนวนภาชนะบรรจุ<br>TOTAL UNIT</th>
            <th colspan="8">จำนวนสุ่มตรวจ (RANDOM SAMPLING CHECK)</th>
            <th rowspan="2" class="sign">ส่งโดยฝ่ายผลิต<br>SENT BY<br>PRODUCTION</th>
            <th rowspan="2" class="sign">รับโดยเวนเดอร์<br>RECEIVED BY<br>VENDOR</th>
            <th rowspan="2" class="sign">ตรวจสอบสินค้าโดย รปภ<br>CHECKED BY<br>GUARDMAN</th>
          </tr>
          <tr>
            <th class="sample">1</th>
            <th class="sample">2</th>
            <th class="sample">3</th>
            <th class="sample">4</th>
            <th class="sample">5</th>
            <th class="sample">6</th>
            <th class="sample">7</th>
            <th class="sample">8</th>
          </tr>
        </thead>
  
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
  
      <div class="footer">
        <div class="note">
          <div>ต้นฉบับ &nbsp;&nbsp;&nbsp;&nbsp; : ฝ่ายบัญชี</div>
          <div>ORIGINAL &nbsp;&nbsp; : ACCOUNT DIVISION</div>
          <div>หมายเหตุ &nbsp;&nbsp;&nbsp;&nbsp; : 1. ห้ามทำการลบ,ขีด,ฆ่า ข้อมูลใด ๆทั้งสิ้น</div>
          <div class="small">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;NOT ALLOW TO DELETE OR CORRECT ANY DATA</div>
        </div>
  
        <div class="approve">
          <div>อนุมัติโดย &nbsp;&nbsp; : ....................................................</div>
          <div>APPROVED BY (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
          <div>วันที่ (DATE)&nbsp; : ....................................................</div>
        </div>
      </div>
  
      <div class="code">M2-4239A4</div>
    </div>
  </body>
  </html>
      `;
  
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
  
      const page = await browser.newPage();
  
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });
  
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        scale: 0.92,
        margin: {
          top: '8mm',
          right: '8mm',
          bottom: '8mm',
          left: '8mm',
        },
      });
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="HomeWorkGatePass-Test.pdf"');
      return res.send(pdfBuffer);
  
    } catch (e) {
      return res.status(500).send({ error: e.message });
    } finally {
      if (browser) await browser.close();
    }
  },




  downloadPdf: async (req, res) => {
    let browser;
  
    try {
      const { default: puppeteer } = await import('puppeteer');
  
      const chunkSize = 500;
      const { filters } = req.body || {};
  
      const norm = (v) => (v ?? '').toString().trim();
      const normLower = (v) => norm(v).toLowerCase();
  
      const {
        itemNo,
        itemName,
        boxState,
        vendor,
        controlLot,
        issueNo,
        receiveNo,
        groupName,
        issueShipDateFrom,
        issueShipDateTo,
        receiveShipDateFrom,
        receiveShipDateTo,
      } = filters || {};
  
      const escapeHtml = (v) => {
        return (v ?? '')
          .toString()
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };
  
      const formatNumber = (v) => {
        const n = Number(v || 0);
        if (!Number.isFinite(n)) return '';
        return n.toLocaleString('en-US');
      };
  
      const startOfDayMs = (ymd) => {
        if (!ymd) return null;
        const [y, m, d] = String(ymd).split('-').map(Number);
        const t = new Date(y, m - 1, d, 0, 0, 0, 0);
        const ms = t.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
  
      const endOfDayMs = (ymd) => {
        if (!ymd) return null;
        const [y, m, d] = String(ymd).split('-').map(Number);
        const t = new Date(y, m - 1, d, 23, 59, 59, 999);
        const ms = t.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
  
      const formatDateDDMMYYYY = (ymd) => {
        if (!ymd) return '';
        const [y, m, d] = String(ymd).split('-');
        return `${d}-${m}-${y}`;
      };
  
      const issueShipFromMs = startOfDayMs(issueShipDateFrom);
      const issueShipToMs = endOfDayMs(issueShipDateTo);
      const receiveShipFromMs = startOfDayMs(receiveShipDateFrom);
      const receiveShipToMs = endOfDayMs(receiveShipDateTo);
  
      let lastId = null;
      const groupMap = new Map();
  
      while (true) {
        const boxes = await prisma.box.findMany({
          where: {
            status: 'use',
            ...(lastId ? { id: { lt: lastId } } : {}),
          },
          include: {
            HeaderIssue: {
              include: {
                User: true,
                Group: { select: { name: true } },
              },
            },
          },
          orderBy: { id: 'desc' },
          take: chunkSize,
        });
  
        if (!boxes.length) break;
        lastId = boxes[boxes.length - 1].id;
  
        const receiveIds = [
          ...new Set(boxes.map((b) => b.receiveId).filter(Boolean)),
        ];
  
        const receives = receiveIds.length
          ? await prisma.headerReceive.findMany({
              where: { id: { in: receiveIds } },
              include: { User: true },
            })
          : [];
  
        const recvMap = new Map(receives.map((r) => [r.id, r]));
  
        for (const b of boxes) {
          const issue = b.HeaderIssue;
          const recv = b.receiveId ? recvMap.get(b.receiveId) : null;
  
          const shipI = issue?.sentDateByUser ?? null;
          const shipR = recv?.receiveDateByUser ?? null;
  
          const shipIMs = shipI ? new Date(shipI).getTime() : null;
          const shipRMs = shipR ? new Date(shipR).getTime() : null;
  
          const row = {
            itemNo: b.itemNo ?? '',
            itemName: b.itemName ?? '',
            dieNo: b.dieNo ?? '',
            qty: Number(b.qty || 0),
  
            vendor: issue?.vender ?? '',
            controlLot: issue?.controlLot ?? '',
            group: issue?.Group?.name ?? '',
            issueNo: issue?.issueLotNo ?? '',
            receiveNo: recv?.receiveLotNo ?? '',
            boxState: b.BoxState ?? '',
          };
  
          if (itemNo && row.itemNo !== itemNo) continue;
          if (itemName && row.itemName !== itemName) continue;
          if (vendor && row.vendor !== vendor) continue;
          if (controlLot && row.controlLot !== controlLot) continue;
          if (groupName && row.group !== groupName) continue;
          if (issueNo && row.issueNo !== issueNo) continue;
          if (receiveNo && row.receiveNo !== receiveNo) continue;
          if (boxState && normLower(row.boxState) !== normLower(boxState)) continue;
  
          if (issueShipFromMs != null) {
            if (shipIMs == null || shipIMs < issueShipFromMs) continue;
          }
  
          if (issueShipToMs != null) {
            if (shipIMs == null || shipIMs > issueShipToMs) continue;
          }
  
          if (receiveShipFromMs != null) {
            if (shipRMs == null || shipRMs < receiveShipFromMs) continue;
          }
  
          if (receiveShipToMs != null) {
            if (shipRMs == null || shipRMs > receiveShipToMs) continue;
          }
  
          const key = `${row.itemNo}||${row.itemName}||${row.dieNo}`;
  
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              itemNo: row.itemNo,
              itemName: row.itemName,
              dieNo: row.dieNo,
              qty: 0,
              totalUnit: 0,
            });
          }
  
          const g = groupMap.get(key);
          g.qty += row.qty;
          g.totalUnit += 1;
        }
  
        if (boxes.length < chunkSize) break;
      }
  
      const printRows = Array.from(groupMap.values())
        .sort((a, b) => {
          const byName = a.itemName.localeCompare(b.itemName);
          if (byName !== 0) return byName;
  
          const byItemNo = a.itemNo.localeCompare(b.itemNo);
          if (byItemNo !== 0) return byItemNo;
  
          return a.dieNo.localeCompare(b.dieNo);
        })
        .map((x, index) => ({
          no: index + 1,
          poNo: x.dieNo,
          partNo: x.itemNo,
          partName: x.itemName,
          qtyOut: x.qty,
          unit: 'PCS',
          totalUnit: `${x.totalUnit} BOX`,
        }));
  
      const maxRows = 13;
  
      const tableRowsHtml = Array.from({ length: maxRows }).map((_, i) => {
        const r = printRows[i];
  
        return `
          <tr>
            <td>${r ? escapeHtml(r.no) : ''}</td>
            <td>${r ? escapeHtml(r.poNo) : ''}</td>
            <td></td>
            <td>${r ? escapeHtml(r.partNo) : ''}</td>
            <td>${r ? escapeHtml(r.partName) : ''}</td>
            <td>${r ? escapeHtml(formatNumber(r.qtyOut)) : ''}</td>
            <td>${r ? escapeHtml(r.unit) : ''}</td>
            <td>${r ? escapeHtml(r.totalUnit) : ''}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        `;
      }).join('');
  
      const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      @page {
        size: A4 landscape;
        margin: 8mm;
      }
  
      * {
        box-sizing: border-box;
      }
  
      body {
        font-family: Arial, "TH Sarabun New", sans-serif;
        margin: 0;
        color: #333;
        font-size: 11px;
      }
  
      .page {
        width: 100%;
        min-height: 190mm;
        position: relative;
      }
  
      .top {
        display: grid;
        grid-template-columns: 1fr 2fr 1fr;
        align-items: start;
        margin-bottom: 14px;
      }
  
      .title {
        text-align: center;
        font-weight: bold;
        line-height: 1.45;
      }
  
      .title .company {
        font-size: 23px;
      }
  
      .title .thai {
        font-size: 20px;
      }
  
      .title .eng {
        font-size: 17px;
      }
  
      .title .division {
        font-size: 16px;
        margin-top: 6px;
      }
  
      .form-no {
        text-align: right;
        line-height: 2.3;
        font-size: 12px;
        padding-top: 8px;
      }
  
      .header-grid {
        display: grid;
        grid-template-columns: 2.1fr 1.6fr 2fr 0.9fr 2.2fr;
        gap: 26px;
        align-items: start;
        margin-bottom: 16px;
      }
  
      table {
        border-collapse: collapse;
        width: 100%;
      }
  
      .box-table td,
      .box-table th {
        border: 1px solid #444;
        height: 34px;
        text-align: center;
        vertical-align: middle;
      }
  
      .box-table th {
        font-weight: normal;
        font-size: 13px;
      }
  
      .check-table td {
        border: 1px solid #444;
        height: 26px;
        padding: 2px 8px;
      }
  
      .check-box {
        display: inline-block;
        width: 22px;
        height: 20px;
        border: 1px solid #444;
        margin-right: 22px;
        vertical-align: middle;
      }
  
      .right-info {
        line-height: 3.3;
        font-size: 13px;
        white-space: nowrap;
      }
  
      .dot {
        display: inline-block;
        border-bottom: 1px dotted #555;
        width: 165px;
        height: 18px;
        line-height: 18px;
        text-align: center;
      }
  
      .main-table th,
      .main-table td {
        border: 1px solid #444;
        text-align: center;
        vertical-align: middle;
      }
  
      .main-table th {
        height: 34px;
        font-weight: normal;
        line-height: 1.35;
        font-size: 11px;
      }
  
      .main-table td {
        height: 26px;
        padding: 1px 3px;
        font-size: 10px;
        word-break: break-word;
      }
  
      .main-table .no { width: 34px; }
      .main-table .po { width: 78px; }
      .main-table .qty { width: 58px; }
      .main-table .partno { width: 112px; }
      .main-table .desc { width: 122px; }
      .main-table .qtyout { width: 58px; }
      .main-table .unit { width: 50px; }
      .main-table .totalunit { width: 88px; }
      .main-table .sample { width: 38px; }
      .main-table .sign { width: 86px; }
  
      .footer {
        display: grid;
        grid-template-columns: 1fr 1fr;
        margin-top: 10px;
        font-size: 13px;
      }
  
      .note {
        line-height: 1.8;
      }
  
      .approve {
        justify-self: end;
        width: 310px;
        line-height: 2.4;
      }
  
      .small {
        font-size: 10px;
      }
  
      .code {
        position: absolute;
        right: 0;
        bottom: 0;
        font-size: 9px;
      }
    </style>
  </head>
  
  <body>
    <div class="page">
  
      <div class="top">
        <div></div>
  
        <div class="title">
          <div class="company">NMB-Minebea Thai Ltd.</div>
          <div class="thai">ใบผ่านงาน HOME WORK (ขาออก)</div>
          <div class="eng">HOME WORK GATE PASS (OUT)</div>
          <div class="division">DIVISION................PRESS...................</div>
        </div>
  
        <div class="form-no">
          <div>แบบฟอร์มที่&nbsp;&nbsp; 1</div>
          <div>FROM&nbsp;&nbsp; 1</div>
        </div>
      </div>
  
      <div class="header-grid">
        <table class="box-table">
          <tr>
            <th>ชื่อเวนเดอร์<br>VENDOR NAME</th>
            <th>เลขที่เวนเดอร์<br>VENDOR CODE</th>
          </tr>
          <tr>
            <td>${escapeHtml(vendor || '')}</td>
            <td></td>
          </tr>
        </table>
  
        <table class="check-table">
          <tr><td><span class="check-box"></span>OVER ISSUED</td></tr>
          <tr><td><span class="check-box"></span>NG TO REWORK</td></tr>
          <tr><td><span class="check-box"></span>NIGHT SHIFT</td></tr>
        </table>
  
        <table class="box-table">
          <tr>
            <th>รหัสสินค้า<br>ITEM NAME</th>
            <th>เลขที่สินค้า<br>ITEM NO</th>
          </tr>
          <tr>
            <td></td>
            <td></td>
          </tr>
        </table>
  
        <table class="box-table">
          <tr>
            <th>เลขที่รุ่น<br>MODEL NO</th>
          </tr>
          <tr>
            <td></td>
          </tr>
        </table>
  
        <div class="right-info">
          <div>เลขที่ (NO)&nbsp;&nbsp;<span class="dot"></span></div>
          <div>วันที่ (DATE)&nbsp;&nbsp;<span class="dot">${formatDateDDMMYYYY(issueShipDateFrom)}</span></div>
          <div>เวลา (TIME)&nbsp;&nbsp;<span class="dot"></span></div>
        </div>
      </div>
  
      <table class="main-table">
        <thead>
          <tr>
            <th rowspan="2" class="no">ลำดับที่<br>NO.</th>
            <th rowspan="2" class="po">เลขที่ P/O<br>P/O NO</th>
            <th rowspan="2" class="qty">จำนวน<br>QTY</th>
            <th rowspan="2" class="partno">เลขที่ชิ้นงาน<br>PART NO</th>
            <th rowspan="2" class="desc">ชื่องาน/รายละเอียด<br>PART NAME/<br>DESCRIPTION</th>
            <th rowspan="2" class="qtyout">จำนวนส่งออก<br>QTY (OUT)</th>
            <th rowspan="2" class="unit">หน่วยนับ<br>UNIT</th>
            <th rowspan="2" class="totalunit">จำนวนภาชนะบรรจุ<br>TOTAL UNIT</th>
            <th colspan="8">จำนวนสุ่มตรวจ (RANDOM SAMPLING CHECK)</th>
            <th rowspan="2" class="sign">ส่งโดยฝ่ายผลิต<br>SENT BY<br>PRODUCTION</th>
            <th rowspan="2" class="sign">รับโดยเวนเดอร์<br>RECEIVED BY<br>VENDOR</th>
            <th rowspan="2" class="sign">ตรวจสอบสินค้าโดย รปภ<br>CHECKED BY<br>GUARDMAN</th>
          </tr>
          <tr>
            <th class="sample">1</th>
            <th class="sample">2</th>
            <th class="sample">3</th>
            <th class="sample">4</th>
            <th class="sample">5</th>
            <th class="sample">6</th>
            <th class="sample">7</th>
            <th class="sample">8</th>
          </tr>
        </thead>
  
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>
  
      <div class="footer">
        <div class="note">
          <div>ต้นฉบับ &nbsp;&nbsp;&nbsp;&nbsp; : ฝ่ายบัญชี</div>
          <div>ORIGINAL &nbsp;&nbsp; : ACCOUNT DIVISION</div>
          <div>หมายเหตุ &nbsp;&nbsp;&nbsp;&nbsp; : 1. ห้ามทำการลบ,ขีด,ฆ่า ข้อมูลใด ๆทั้งสิ้น</div>
          <div class="small">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;NOT ALLOW TO DELETE OR CORRECT ANY DATA</div>
        </div>
  
        <div class="approve">
          <div>อนุมัติโดย &nbsp;&nbsp; : ....................................................</div>
          <div>APPROVED BY (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
          <div>วันที่ (DATE)&nbsp; : ....................................................</div>
        </div>
      </div>
  
      <div class="code">M2-4239A4</div>
    </div>
  </body>
  </html>
      `;
  
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
  
      const page = await browser.newPage();
  
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });
  
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        scale: 0.92,
        margin: {
          top: '8mm',
          right: '8mm',
          bottom: '8mm',
          left: '8mm',
        },
      });
  
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
  
      const timeStamp =
        now.getFullYear() +
        pad(now.getMonth() + 1) +
        pad(now.getDate()) +
        '_' +
        pad(now.getHours()) +
        pad(now.getMinutes()) +
        pad(now.getSeconds());
  
      const safeVendor = (vendor || 'Vendor')
        .replace(/[<>:"/\\|?*]/g, '')
        .trim();
  
      const fileName =
        `HomeWorkGatePass_${safeVendor}_${issueShipDateFrom || 'Print'}_${timeStamp}.pdf`;
  
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(pdfBuffer);
  
    } catch (e) {
      return res.status(500).send({ error: e.message });
    } finally {
      if (browser) await browser.close();
    }
  }



}


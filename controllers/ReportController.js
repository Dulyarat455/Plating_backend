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
        dateFrom,
        dateTo,
        groupName,
      } = filters || {};
  
      // ---------- helpers ----------
      const formatTime = (d) => {
        if (!d) return '';
        const x = new Date(d);
        if (isNaN(x.getTime())) return '';
        return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}:${String(
          x.getSeconds()
        ).padStart(2, '0')}`;
      };
  
      // DD/MM/YYYY
      const formatDateDMY = (d) => {
        if (!d) return '';
        const x = new Date(d);
        if (isNaN(x.getTime())) return '';
        const dd = String(x.getDate()).padStart(2, '0');
        const mm = String(x.getMonth() + 1).padStart(2, '0');
        const yyyy = x.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
      };
  
      // ใช้สำหรับ filter date (อ้างอิงจาก IssueDate = sentDate)
      const startOfDayMs = (yyyy_mm_dd) => {
        if (!yyyy_mm_dd) return null;
        const t = new Date(yyyy_mm_dd);
        const ms = t.getTime();
        return Number.isFinite(ms) ? ms : null;
      };
  
      const endOfDayMs = (yyyy_mm_dd) => {
        const s = startOfDayMs(yyyy_mm_dd);
        if (s == null) return null;
        return s + 86400000 - 1;
      };
  
      const fromMs = startOfDayMs(dateFrom);
      const toMs = endOfDayMs(dateTo);
  
      // =====================================================
      // 1) stream Box ทีละ 500 + join Issue + User + Group
      // =====================================================
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
                User: true, // Issue By
                Group: { select: { name: true } }, // Group
              },
            },
          },
          orderBy: { id: 'desc' },
          take: chunkSize,
        });
  
        if (!boxes.length) break;
        lastId = boxes[boxes.length - 1].id;
  
        // =====================================================
        // 2) load HeaderReceive ของ chunk นี้ (IN 500)
        // =====================================================
        const receiveIds = [...new Set(boxes.map((b) => b.receiveId).filter(Boolean))];
  
        const receives = receiveIds.length
          ? await prisma.headerReceive.findMany({
              where: { id: { in: receiveIds } },
              include: { User: true }, // Receive By
            })
          : [];
  
        const recvMap = new Map(receives.map((r) => [r.id, r]));
  
        // =====================================================
        // 3) build userId -> sectionName map (Issue + Receive) ของ chunk นี้
        // =====================================================
        const issueUserIds = boxes.map((b) => b.HeaderIssue?.userId).filter(Boolean);
        const recvUserIds = receives.map((r) => r.userId).filter(Boolean);
  
        const userIds = [...new Set([...issueUserIds, ...recvUserIds])];
  
        const userSectionMap = new Map(); // userId -> sectionName
  
        if (userIds.length) {
          // เอา MapGroupSection ตัวแรกของ user นั้น (orderBy id asc)
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
  
          // ใส่แค่ครั้งแรก (ตัวแรกสุด) ต่อ userId
          for (const m of maps) {
            if (!userSectionMap.has(m.userId)) {
              userSectionMap.set(m.userId, m.Section?.name ?? '');
            }
          }
        }
  
        // =====================================================
        // 4) flatten + apply filters ทีละ chunk
        // =====================================================
        for (const b of boxes) {
          const issue = b.HeaderIssue;
          const recv = b.receiveId ? recvMap.get(b.receiveId) : null;
  
          const issueDateObj = issue?.sentDate ? new Date(issue.sentDate) : null;
          const issueMs = issueDateObj && !isNaN(issueDateObj.getTime()) ? issueDateObj.getTime() : null;
  
          // shipment refs
          const shipI = issue?.sentDateByUser ?? null; // HeaderIssue.sentDateByUser
          const shipR = recv?.receiveDateByUser ?? null; // HeaderReceive.receiveDateByUser
  
          // ✅ sections
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
  
            // ✅ NEW: IssueSection
            issueSection: issueSection,
  
            shipmentDateI: formatDateDMY(shipI),
            shipmentTimeI: formatTime(shipI),
  
            receiveNo: recv?.receiveLotNo ?? '',
            receiveDate: formatDateDMY(recv?.receiveDate),
            timeReceive: formatTime(recv?.receiveDate),
            receiveBy: recv?.User?.name ?? '',
            receiveEmpNo: recv?.User?.empNo ?? '',
            shiftReceive: recv?.shift ?? '',
  
            // ✅ NEW: ReceiveSection (อาจว่างได้)
            receiveSection: receiveSection,
  
            shipmentDateR: formatDateDMY(shipR),
            shipmentTimeR: formatTime(shipR),
  
            boxState: b.BoxState ?? '',
          };
  
          // ---------- filters ----------
          if (itemNo && row.itemNo !== itemNo) continue;
          if (itemName && row.itemName !== itemName) continue;
  
          if (vendor && row.vendor !== vendor) continue;
          if (controlLot && row.controlLot !== controlLot) continue;
  
          if (groupName && row.group !== groupName) continue;
  
          if (issueNo && row.issueNo !== issueNo) continue;
          if (receiveNo && row.receiveNo !== receiveNo) continue;
  
          if (boxState && normLower(row.boxState) !== normLower(boxState)) continue;
  
          // Date range อ้างอิงจาก IssueDate (sentDate)
          if (fromMs != null) {
            if (issueMs == null || issueMs < fromMs) continue;
          }
          if (toMs !=null) {
            if (issueMs == null || issueMs > toMs) continue;
          }
  
          allRows.push(row);
        }
  
        if (boxes.length < chunkSize) break;
      }
  
      // =====================================================
      // 5) create excel
      // =====================================================
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
        { header: 'IssueBy', key: 'issueBy', width: 22 },
        { header: 'IssueEmpNo', key: 'issueEmpNo', width: 14 },
        { header: 'Shift(I)', key: 'shiftIssue', width: 10 },
  
        // ✅ NEW
        { header: 'IssueSection', key: 'issueSection', width: 16 },
  
        { header: 'ShipmentDate(I)', key: 'shipmentDateI', width: 14 },
        { header: 'ShipmentTime(I)', key: 'shipmentTimeI', width: 14 },
  
        { header: 'ReceiveNo', key: 'receiveNo', width: 16 },
        { header: 'ReceiveDate', key: 'receiveDate', width: 12 },
        { header: 'TimeReceive', key: 'timeReceive', width: 12 },
        { header: 'ReceiveBy', key: 'receiveBy', width: 22 },
        { header: 'ReceiveEmpNo', key: 'receiveEmpNo', width: 14 },
        { header: 'Shift(R)', key: 'shiftReceive', width: 10 },
  
        // ✅ NEW
        { header: 'ReceiveSection', key: 'receiveSection', width: 16 },
  
        { header: 'ShipmentDate(R)', key: 'shipmentDateR', width: 14 },
        { header: 'ShipmentTime(R)', key: 'shipmentTimeR', width: 14 },
  
        { header: 'BoxState', key: 'boxState', width: 12 },
      ];
  
      ws.getRow(1).font = { bold: true };
      for (const r of allRows) ws.addRow(r);
  
      // =====================================================
      // 6) send file (ชื่อเดิมตามของคุณ)
      // =====================================================
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Report.xlsx"`);
  
      await wb.xlsx.write(res);
      return res.end();
    } catch (e) {
      return res.status(500).send({ error: e.message });
    }
  },
  
}


const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();

const ExcelJS = require('exceljs');



module.exports = {

    add: async (req,res) =>{
        try{
            const { itemNo, itemName, groupId, role } = req.body;

            if (role !== "admin") {
                return res.status(400).send({ message: "Role_not_allowed" });
            }  
            
            if (
                itemNo == null ||
                itemName == null ||
                groupId == null   
              ) {
                return res.status(400).send({ message: 'missing_required_fields' });
              }

            //check  
            const checkPartMaster = await prisma.partMaster.findFirst({
                where: {
                  itemNo: itemNo,
                  itemName: itemName,
                  groupId: parseInt(groupId),
                  status: 'use',
                },
              });

              if (checkPartMaster) {
                return res.status(400).send({ message: 'Part_Master_already', data: checkPartMaster});
              }
              
              
              const partMaster = await prisma.partMaster.create({
                data: {
                  itemNo: itemNo ,
                  itemName: itemName,
                  groupId: parseInt(groupId),
                },
                select: {
                  id: true,
                  itemNo: true,
                  itemName: true,
                  groupId: true,
                  status: true,
                },
              });

              return res.send({
                message: 'add_partMaster_success',
                data: partMaster,
            });   

        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },

    filterByGroup: async (req,res) => {
        try{

          const {groupId} = req.body;

          const rows = await prisma.partMaster.findMany({
              where: {
                  status: 'use',
                  groupId: parseInt(groupId)
              },
              select:{
                id: true,
                itemNo: true,
                itemName: true,
                groupId: true,
              },
              orderBy: { itemNo: 'asc' },
          })
          return res.send({ results: rows })

      }catch(e){
          return res.status(500).send({ error: e.message });
      }
    }, 



    edit: async (req,res) => {
        try{

        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    
    },



    list: async (req, res) => {
      try {
        // -------------------------
        // 1) fetch ids ก่อน
        // -------------------------
        const ids = await prisma.partMaster.findMany({
          where: { status: 'use' },
          orderBy: { id: 'asc' },
          select: { id: true },
        });
    
        const idList = ids.map(x => x.id);
    
        // -------------------------
        // 2) chunk fetch 500
        // -------------------------
        const chunkSize = 500;
        const allRows = [];
    
        for (let i = 0; i < idList.length; i += chunkSize) {
          const chunk = idList.slice(i, i + chunkSize);
    
          const rows = await prisma.partMaster.findMany({
            where: { id: { in: chunk } },
            orderBy: { id: 'asc' },
            select: {
              id: true,
              itemNo: true,
              itemName: true,
              groupId: true,
              createdAt: true,
              Group: { select: { name: true } },
            },
          });
    
          allRows.push(...rows);
        }
    
        // -------------------------
        // 3) flatten Group.name
        // -------------------------
        const results = allRows.map(r => ({
          id: r.id,
          itemNo: r.itemNo,
          itemName: r.itemName,
          groupId: r.groupId,
          createdAt: r.createdAt,
          groupName: r.Group?.name || null,
        }));
    
        return res.send({ results });
    
      } catch (e) {
        return res.status(500).send({ error: e.message });
      }
    },
    



    importExcel: async (req, res) => {
      try {
        const { role } = req.body;
    
        if (role !== "admin") {
          return res.status(400).send({ message: "Role_not_allowed" });
        }
    
        if (!req.file) {
          return res.status(400).send({ message: "missing_file" });
        }
    
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
    
        const ws = workbook.worksheets[0];
        if (!ws) return res.status(400).send({ message: "sheet_not_found" });
    
        // --- read header row ---
        const headerRow = ws.getRow(1);
        const headerMap = {}; // { itemno: col, itemname: col, group: col }
    
        headerRow.eachCell((cell, colNumber) => {
          const v = String(cell.value ?? '').trim().toLowerCase();
          if (!v) return;
    
          if (['itemno', 'item no', 'item_no'].includes(v)) headerMap.itemno = colNumber;
          if (['itemname', 'item name', 'item_name'].includes(v)) headerMap.itemname = colNumber;
          if (['group', 'groupname', 'group name', 'group_name'].includes(v)) headerMap.group = colNumber;
        });
    
        if (!headerMap.itemno || !headerMap.itemname || !headerMap.group) {
          return res.status(400).send({
            message: "invalid_header",
            expect: ["ItemNo", "ItemName", "Group"],
          });
        }
    
        // ✅ โหลด group ทั้งหมดไว้ทำ map: name -> id
        const groups = await prisma.group.findMany({
          where: { status: 'use' },
          select: { id: true, name: true },
        });
    
        const groupMap = new Map(
          groups.map(g => [String(g.name).trim().toLowerCase(), g.id])
        );
    
        // ✅ โหลด PartMaster ที่มีอยู่แล้วเพื่อกันซ้ำ itemNo+itemName
        const exists = await prisma.partMaster.findMany({
          where: { status: 'use' },
          select: { itemNo: true, itemName: true },
        });
    
        const existSet = new Set(
          exists.map(x => `${String(x.itemNo).trim()}|${String(x.itemName).trim()}`)
        );
    
        const fileSet = new Set();
        const toInsert = [];
        const duplicates = [];
        const invalidRows = [];
    
        const lastRow = ws.rowCount || 0;
    
        for (let r = 2; r <= lastRow; r++) {
          const row = ws.getRow(r);
    
          const itemNo = String(row.getCell(headerMap.itemno).value ?? '').trim();
          const itemName = String(row.getCell(headerMap.itemname).value ?? '').trim();
          const groupNameRaw = String(row.getCell(headerMap.group).value ?? '').trim();
          const groupKey = groupNameRaw.toLowerCase();
    
          // skip empty row
          if (!itemNo && !itemName && !groupNameRaw) continue;
    
          // validate required
          if (!itemNo || !itemName || !groupNameRaw) {
            invalidRows.push({ row: r, itemNo, itemName, group: groupNameRaw, reason: 'missing_required' });
            continue;
          }
    
          // map groupName -> groupId
          const groupId = groupMap.get(groupKey);
          if (!groupId) {
            invalidRows.push({ row: r, itemNo, itemName, group: groupNameRaw, reason: 'group_not_found' });
            continue;
          }
    
          const key = `${itemNo}|${itemName}`;
    
          // duplicate in file
          if (fileSet.has(key)) {
            duplicates.push({ row: r, itemNo, itemName, reason: 'duplicate_in_file' });
            continue;
          }
          fileSet.add(key);
    
          // duplicate in DB
          if (existSet.has(key)) {
            duplicates.push({ row: r, itemNo, itemName, reason: 'already_exists' });
            continue;
          }
    
          toInsert.push({
            itemNo,
            itemName,
            groupId,
          });
        }
    
        let insertedCount = 0;
        if (toInsert.length) {
          const created = await prisma.partMaster.createMany({ data: toInsert });
          insertedCount = created.count || 0;
        }
    
        return res.send({
          message: "import_excel_success",
          summary: {
            totalRows: Math.max(0, lastRow - 1),
            inserted: insertedCount,
            skippedDuplicate: duplicates.length,
            invalid: invalidRows.length,
          },
          duplicates,
          invalidRows,
        });
    
      } catch (e) {
        return res.status(500).send({ error: e.message });
      }
    },
    



    exportExcel: async (req, res) => {
      try {
        const { filters } = req.body || {};
    
        const itemNo = (filters?.itemNo ?? '').toString().trim();
        const itemName = (filters?.itemName ?? '').toString().trim();
        const groupId = filters?.groupId ?? null;
    
        // -------------------------
        // build dynamic where
        // -------------------------
        const where = { status: 'use' };
    
        if (itemNo) where.itemNo = { contains: itemNo };
        if (itemName) where.itemName = { contains: itemName };
        if (groupId != null) where.groupId = Number(groupId);
    
        // -------------------------
        // 1) fetch ids
        // -------------------------
        const ids = await prisma.partMaster.findMany({
          where,
          orderBy: { id: 'asc' },
          select: { id: true },
        });
    
        const idList = ids.map(x => x.id);
    
        // -------------------------
        // 2) chunk fetch
        // -------------------------
        const chunkSize = 500;
        const allRows = [];
    
        for (let i = 0; i < idList.length; i += chunkSize) {
          const chunk = idList.slice(i, i + chunkSize);
    
          const rows = await prisma.partMaster.findMany({
            where: { id: { in: chunk } },
            orderBy: { id: 'asc' },
            include: { Group: true },
          });
    
          allRows.push(...rows);
        }
    
        // -------------------------
        // helper: UTC -> Thai Date
        // -------------------------
        const toThaiDate = (dt) => {
          if (!dt) return null;
          return new Date(dt.getTime() + 7 * 60 * 60 * 1000);
        };
    
        // -------------------------
        // 3) create excel
        // -------------------------
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('PartMaster');
    
        ws.columns = [
          { header: 'ItemNo', key: 'itemNo', width: 20 },
          { header: 'ItemName', key: 'itemName', width: 35 },
          { header: 'Group', key: 'groupName', width: 18 },
          { header: 'CreatedAt', key: 'createdAt', width: 22 },
        ];
    
        // header bold
        ws.getRow(1).font = { bold: true };
    
        for (const r of allRows) {
          ws.addRow({
            itemNo: r.itemNo,
            itemName: r.itemName,
            groupName: r.Group?.name ?? '',
            createdAt: toThaiDate(r.createdAt), // ✅ Date object (ไทย)
          });
        }
    
        // format column เป็นวันไทย
        ws.getColumn('createdAt').numFmt = 'dd/mm/yyyy hh:mm:ss';
    
        // -------------------------
        // 4) send file
        // -------------------------
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="PartMaster.xlsx"'
        );
    
        await wb.xlsx.write(res);
        res.end();
    
      } catch (e) {
        return res.status(500).send({ error: e.message });
      }
    },



    edit: async (req, res) => {
      try{

        const { id, itemNo, itemName, groupId } = req.body;

        if (id == null) {
          return res.status(400).send({ message: 'missing_id' });
        }

        if (
          itemNo == null ||
          itemName == null ||
          groupId == null   
        ) {
          return res.status(400).send({ message: 'missing_required_fields' });
        }


        // ตรวจสอบว่ามี record นี้อยู่ไหม
        const existing = await prisma.partMaster.findFirst({
          where: { id: Number(id), status: 'use' }
        });

        if (!existing) {
          return res.status(404).send({ message: 'partMaster_not_found' });
        }

        // ตรวจสอบข้อมูลซ้ำ (ยกเว้น id ตัวเอง)
        const duplicate = await prisma.partMaster.findFirst({
          where: {
            id: { not: Number(id) },
            itemNo,
            itemName,
            groupId: Number(groupId),
            status: 'use'
          }
        });

        if (duplicate) {
          return res.status(400).send({ message: 'Part_Master_already' });
        }

        // update
        const updated = await prisma.partMaster.update({
          where: { id: Number(id) },
          data: {
            itemNo,
            itemName,
            groupId: Number(groupId),
          },
          include: {
            Group: true
          }
        });

        return res.send({
          message: 'edit_partMaster_success',
          data: {
            id: updated.id,
            itemNo: updated.itemNo,
            itemName: updated.itemName,
            groupId: updated.groupId,
            groupName: updated.Group?.name ?? null
          }
        });


      }catch(e){
        return res.status(500).send({ error: e.message });
      }

    },

    

    delete: async (req, res) => {
      try {
        const { id } = req.body;
    
        if (!id) {
          return res.status(400).send({ message: 'missing_id' });
        }
    
        const existing = await prisma.partMaster.findFirst({
          where: { id: Number(id), status: 'use' }
        });
    
        if (!existing) {
          return res.status(404).send({ message: 'partMaster_not_found' });
        }
    
        await prisma.partMaster.update({
          where: { id: Number(id) },
          data: { status: 'delete' }
        });
    
        return res.send({
          message: 'delete_partMaster_success'
        });
    
      } catch (e) {
        return res.status(500).send({ error: e.message });
      }
    },
    




}
const {PrismaClient} = require('../generated/prisma');
const { edit } = require('./SectionController');
const prisma = new PrismaClient();

module.exports = {
    fetchIssue: async (req, res) => {
        try {
          const chunkSize = 500;
      
          let lastId = null;
          const allIssues = [];
      
          while (true) {
            const issues = await prisma.headerIssue.findMany({
              where: {
                ...(lastId
                  ? {
                      id: {
                        gt: lastId,
                      },
                    }
                  : {}),
              },
      
              select: {
                // =========================
                // HeaderIssue
                // =========================
                id: true,
                issueLotNo: true,
                sentDate: true,
                sentDateByUser: true,
      
                userId: true,
                groupId: true,
      
                shift: true,
                vender: true,
                controlLot: true,
                itemNo: true,
                itemName: true,
                qtyBox: true,
                qtySum: true,
                lotState: true,
                status: true,
      
                // =========================
                // User
                // =========================
                User: {
                  select: {
                    empNo: true,
                    name: true,
                  },
                },
      
                // =========================
                // Group
                // =========================
                Group: {
                  select: {
                    name: true,
                  },
                },
              },
      
              orderBy: {
                id: 'asc',
              },
      
              take: chunkSize,
            });
      
            // ไม่มีข้อมูลแล้ว
            if (!issues.length) {
              break;
            }
      
            // =========================
            // จัดรูปแบบข้อมูลก่อนส่ง
            // =========================
            const formattedIssues = issues.map((issue) => ({
              id: issue.id,
              issueLotNo: issue.issueLotNo,
              sentDate: issue.sentDate,
              sentDateByUser: issue.sentDateByUser,
      
              userId: issue.userId,
      
              // จาก Table User
              empNo: issue.User?.empNo ?? '',
              userName: issue.User?.name ?? '',
      
              groupId: issue.groupId,
      
              // จาก Table Group
              groupName: issue.Group?.name ?? '',
      
              shift: issue.shift,
              vender: issue.vender,
              controlLot: issue.controlLot,
              itemNo: issue.itemNo,
              itemName: issue.itemName,
              qtyBox: issue.qtyBox,
              qtySum: issue.qtySum,
              lotState: issue.lotState,
              status: issue.status,
            }));
      
            // รวมเข้า Array หลัก
            allIssues.push(...formattedIssues);
      
            // จำ ID ตัวสุดท้ายของรอบนี้
            lastId = issues[issues.length - 1].id;
      
            // ถ้าไม่ถึง 500 แสดงว่าเป็นรอบสุดท้าย
            if (issues.length < chunkSize) {
              break;
            }
          }
      
          return res.status(200).send(allIssues);
      
        } catch (e) {
          return res.status(500).send({
            error: e.message,
          });
        }
      },



      fetchRecive: async (req, res) => {
        try {
          const chunkSize = 500;
      
          let lastId = null;
          const allReceives = [];
      
          while (true) {
            const receives = await prisma.headerReceive.findMany({
              where: {
                ...(lastId
                  ? {
                      id: {
                        gt: lastId,
                      },
                    }
                  : {}),
              },
      
              select: {
                // =========================
                // HeaderReceive
                // =========================
                id: true,
                receiveLotNo: true,
                receiveDate: true,
                receiveDateByUser: true,
      
                userId: true,
                groupId: true,
      
                shift: true,
                vender: true,
                controlLot: true,
                itemNo: true,
                itemName: true,
                qtyBox: true,
                qtySum: true,
                lotState: true,
                status: true,
      
                // =========================
                // User
                // =========================
                User: {
                  select: {
                    empNo: true,
                    name: true,
                  },
                },
      
                // =========================
                // Group
                // =========================
                Group: {
                  select: {
                    name: true,
                  },
                },
              },
      
              orderBy: {
                id: 'asc',
              },
      
              take: chunkSize,
            });
      
            // ไม่มีข้อมูลแล้ว
            if (!receives.length) {
              break;
            }
      
            // =========================
            // จัดรูปแบบข้อมูล
            // =========================
            const formattedReceives = receives.map((receive) => ({
              id: receive.id,
      
              receiveLotNo: receive.receiveLotNo,
              receiveDate: receive.receiveDate,
              receiveDateByUser: receive.receiveDateByUser,
      
              // User
              userId: receive.userId,
              empNo: receive.User?.empNo ?? '',
              userName: receive.User?.name ?? '',
      
              // Group
              groupId: receive.groupId,
              groupName: receive.Group?.name ?? '',
      
              shift: receive.shift,
              vender: receive.vender,
              controlLot: receive.controlLot,
      
              itemNo: receive.itemNo,
              itemName: receive.itemName,
      
              qtyBox: receive.qtyBox,
              qtySum: receive.qtySum,
      
              lotState: receive.lotState,
              status: receive.status,
            }));
      
            // รวมข้อมูลเข้า Array หลัก
            allReceives.push(...formattedReceives);
      
            // จำ ID ตัวสุดท้ายของ Chunk ปัจจุบัน
            lastId = receives[receives.length - 1].id;
      
            // ถ้าได้ข้อมูลน้อยกว่า 500
            // แสดงว่าเป็น Chunk สุดท้ายแล้ว
            if (receives.length < chunkSize) {
              break;
            }
          }
      
          return res.status(200).send(allReceives);
      
        } catch (e) {
          return res.status(500).send({
            error: e.message,
          });
        }
      },


      editFieldMasterIssue: async (req, res) => {
        try {
          const {
            id,
            sentDateByUser,
            controlLot,
            vender
          } = req.body;
      
          if (
            id == null ||
            sentDateByUser == null ||
            !controlLot ||
            !vender
          ) {
            return res.status(400).send({
              message: 'missing_required_fields'
            });
          }
      
          const headerIssueId = parseInt(id);
      
          if (isNaN(headerIssueId)) {
            return res.status(400).send({
              message: 'invalid_id'
            });
          }
      
      
          const sentDate = new Date(sentDateByUser);
      
          if (isNaN(sentDate.getTime())) {
            return res.status(400).send({
              message: 'invalid_sentDateByUser'
            });
          }
      
      
          const checkHeaderIssue = await prisma.headerIssue.findUnique({
            where: {
              id: headerIssueId
            },
            select: {
              id: true
            }
          });
      
          if (!checkHeaderIssue) {
            return res.status(404).send({
              message: 'header_issue_not_found'
            });
          }
      
      
          const updatedHeaderIssue = await prisma.headerIssue.update({
            where: {
              id: headerIssueId
            },
            data: {
              sentDateByUser: sentDate,
              controlLot: controlLot.trim(),
              vender: vender.trim()
            },
            select: {
              id: true,
              sentDateByUser: true,
              controlLot: true,
              vender: true
            }
          });
      
          return res.status(200).send({
            message: 'update_header_issue_success',
            data: updatedHeaderIssue
          });
      
        } catch (e) {
          return res.status(500).send({
            error: e.message
          });
        }
      },


      editFieldMasterReceive: async (req, res) => {
        try {
          const {
            id,
            receiveDateByUser,
            controlLot,
            vender
          } = req.body;
      
      
          if (
            id == null ||
            receiveDateByUser == null ||
            !controlLot ||
            !vender
          ) {
            return res.status(400).send({
              message: 'missing_required_fields'
            });
          }
      
      
          const headerReceiveId = parseInt(id);
      
          if (isNaN(headerReceiveId)) {
            return res.status(400).send({
              message: 'invalid_id'
            });
          }
      
          const receiveDate = new Date(receiveDateByUser);
      
          if (isNaN(receiveDate.getTime())) {
            return res.status(400).send({
              message: 'invalid_receiveDateByUser'
            });
          }
      
      
          const checkHeaderReceive = await prisma.headerReceive.findUnique({
            where: {
              id: headerReceiveId
            },
            select: {
              id: true
            }
          });
      
          if (!checkHeaderReceive) {
            return res.status(404).send({
              message: 'header_receive_not_found'
            });
          }
    
          const updatedHeaderReceive = await prisma.headerReceive.update({
            where: {
              id: headerReceiveId
            },
            data: {
              receiveDateByUser: receiveDate,
              controlLot: controlLot.trim(),
              vender: vender.trim()
            },
            select: {
              id: true,
              receiveDateByUser: true,
              controlLot: true,
              vender: true
            }
          });
      
          return res.status(200).send({
            message: 'update_header_receive_success',
            data: updatedHeaderReceive
          });
      
        } catch (e) {
          return res.status(500).send({
            error: e.message
          });
        }
      },




}
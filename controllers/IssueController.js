const { create } = require('domain');
const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();

module.exports = {
    createHeaderTemp: async (req,res) =>{ 
        try{
          const { 
            userId, groupId, shift, venderId, controlLotId,
            itemNo, itemName, qtyBox, sentDateByUser
          } = req.body;
      
          if (
            userId == null ||
            groupId == null ||
            shift == null || 
            venderId == null ||
            controlLotId == null ||
            itemNo == null ||
            itemName == null ||
            qtyBox == null ||
            sentDateByUser == null
          ) {
            return res.status(400).send({ message: 'missing_required_fields' });
          }
      
          const sentDate = new Date(sentDateByUser);
          if (isNaN(sentDate.getTime())) {
            return res.status(400).send({ message: 'invalid_sentDateByUser' });
          }
      
          const headerIssueTemp = await prisma.headerIssueTemp.create({
            data: {
              userId: parseInt(userId),
              groupId: parseInt(groupId),
              venderId: parseInt(venderId),
              controlLotId: parseInt(controlLotId),
              sentDateByUser: sentDate,
              shift,
              itemNo,
              itemName,
              qtyBox: parseInt(qtyBox),
            }
          });
      
          return res.send({
            message: 'add_issue_header_temp_success',
            data: headerIssueTemp,
          });
      
        } catch(e){
          return res.status(500).send({ error: e.message });
        }
      },
      


    fetchHeaderTemp: async (req,res) =>{ 
        try{
            const { userId } = req.body;

            const headerIssueTemp = await prisma.headerIssueTemp.findFirst({
                where: {
                    status: 'use',       
                    userId: parseInt(userId)
                },
                orderBy: { id: 'desc' }
              });
            

              return res.send({ results: headerIssueTemp });  

        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },



    editHeaderTemp: async (req,res) =>{ 
        try{
            const { 
                headTempId,
                    userId, 
                    groupId, 
                    shift,
                    venderId,
                    controlLotId,
                    itemNo,
                    itemName,
                    qtyBox,
            } = req.body;

            if (
                headTempId,
                userId == null ||
                groupId == null ||
                shift == null || 
                venderId == null ||
                controlLotId == null ||
                itemNo == null ||
                itemName == null ||
                qtyBox == null 
              ) {
                return res.status(400).send({ message: 'missing_required_fields' });
              }
              




        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    },





    createBoxTemp: async (req,res) =>{
        try{
            const {
                   headTempId,
                   itemNo, 
                   itemName,
                   wosNo,
                   dieNo,
                   qty
                } = req.body ;


                if (
                    headTempId == null ||
                    itemNo == null ||
                    itemName == null ||
                    wosNo == null ||
                    dieNo == null ||
                    qty == null 
                  ) {
                    return res.status(400).send({ message: 'missing_required_fields' });
                  }


                  const boxIssueTemp = await prisma.boxIssueTemp.create({
                    data: {
                      headerId: parseInt(headTempId) ,
                      itemNo: itemNo,
                      itemName: itemName,
                      wosNo: wosNo,
                      dieNo: dieNo,
                      qty: qty
                    }
                  });

                  return res.send({
                    message: 'add_box_issue_temp_success',
                    data: boxIssueTemp,
                });


        }catch(e){
            return res.status(500).send({ error: e.message });
        }

    },

    






}
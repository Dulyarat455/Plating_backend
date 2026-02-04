const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();


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
                  State: 'use',
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

    imporExcel: async (req,res) => {
        try{


        }catch(e){
            return res.status(500).send({ error: e.message });
        }
    }

}
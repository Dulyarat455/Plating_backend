const {PrismaClient} = require('../generated/prisma');
const prisma = new PrismaClient();


module.exports = {

    add: async (req,res) =>{
        try{
            const  {role, name} =  req.body;

            if (role !== "admin") {
                return res.status(400).send({ message: "Role_not_allowed" });
            }
            if (!name) {
              return res.status(400).send({ message: 'missing_required_fields' });
            }

            const checkVendor = await prisma.vendor.findFirst({
                where: {
                  name: name,
                  status: 'use',
                },
              });

              if (checkVendor) {
                return res.status(400).send({ message: 'vendor_name_already' });
              }  


              const vendor = await prisma.vendor.create({
                data: {
                  name: name
                },
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              });

            return res.send({
                message: 'add_vendor_success',
                data: vendor,
            });


        }catch(e){
            return res.status(500).send({ error: e.message });
        }

    },

    list: async (req, res) => {
      try{
          const rows = await prisma.vendor.findMany({
              where: {
                  State: 'use'
              }
          })
          return res.send({ results: rows })
  
      }catch(e){
          return res.status(500).send({ error: e.message });
      }
  
    },

}

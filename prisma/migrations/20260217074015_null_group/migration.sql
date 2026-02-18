/*
  Warnings:

  - Made the column `groupId` on table `PartMaster` required. This step will fail if there are existing NULL values in that column.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[PartMaster] ALTER COLUMN [groupId] INT NOT NULL;

-- AddForeignKey
ALTER TABLE [dbo].[PartMaster] ADD CONSTRAINT [PartMaster_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

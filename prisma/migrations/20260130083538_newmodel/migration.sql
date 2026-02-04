BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Vendor] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Vendor_status_df] DEFAULT 'use',
    CONSTRAINT [Vendor_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ControlLot] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [ControlLot_status_df] DEFAULT 'use',
    CONSTRAINT [ControlLot_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[PartMaster] (
    [id] INT NOT NULL IDENTITY(1,1),
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [spec] NVARCHAR(1000) NOT NULL,
    [dwg] NVARCHAR(1000) NOT NULL,
    [dieNo] NVARCHAR(1000) NOT NULL,
    [groupId] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [PartMaster_status_df] DEFAULT 'use',
    CONSTRAINT [PartMaster_pkey] PRIMARY KEY CLUSTERED ([id])
);

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

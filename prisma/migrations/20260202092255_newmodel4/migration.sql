/*
  Warnings:

  - You are about to drop the column `spec` on the `PartMaster` table. All the data in the column will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[PartMaster] DROP COLUMN [spec];

-- CreateTable
CREATE TABLE [dbo].[HeaderIssue] (
    [id] INT NOT NULL IDENTITY(1,1),
    [issueLotNo] NVARCHAR(1000) NOT NULL,
    [sentDate] DATETIME2 NOT NULL CONSTRAINT [HeaderIssue_sentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [userId] INT NOT NULL,
    [groupId] INT NOT NULL,
    [shift] NVARCHAR(1000) NOT NULL,
    [vender] NVARCHAR(1000) NOT NULL,
    [controlLot] NVARCHAR(1000) NOT NULL,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [qtyBox] INT NOT NULL,
    [qtySum] INT NOT NULL,
    [lotState] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [HeaderIssue_status_df] DEFAULT 'use',
    CONSTRAINT [HeaderIssue_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[HeaderIssueTemp] (
    [id] INT NOT NULL IDENTITY(1,1),
    [sentDate] DATETIME2 NOT NULL CONSTRAINT [HeaderIssueTemp_sentDate_df] DEFAULT CURRENT_TIMESTAMP,
    [userId] INT NOT NULL,
    [groupId] INT NOT NULL,
    [shift] NVARCHAR(1000) NOT NULL,
    [venderId] INT NOT NULL,
    [controlLotId] INT NOT NULL,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [qtyBox] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [HeaderIssueTemp_status_df] DEFAULT 'use',
    CONSTRAINT [HeaderIssueTemp_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[HeaderReceive] (
    [id] INT NOT NULL IDENTITY(1,1),
    [receiveLotNo] NVARCHAR(1000) NOT NULL,
    [receiveDate] DATETIME2 NOT NULL CONSTRAINT [HeaderReceive_receiveDate_df] DEFAULT CURRENT_TIMESTAMP,
    [userId] INT NOT NULL,
    [groupId] INT NOT NULL,
    [shift] NVARCHAR(1000) NOT NULL,
    [vender] NVARCHAR(1000) NOT NULL,
    [controlLot] NVARCHAR(1000) NOT NULL,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [qtyBox] INT NOT NULL,
    [qtySum] INT NOT NULL,
    [lotState] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [HeaderReceive_status_df] DEFAULT 'use',
    CONSTRAINT [HeaderReceive_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[HeaderReceiveTemp] (
    [id] INT NOT NULL IDENTITY(1,1),
    [receiveDate] DATETIME2 NOT NULL CONSTRAINT [HeaderReceiveTemp_receiveDate_df] DEFAULT CURRENT_TIMESTAMP,
    [userId] INT NOT NULL,
    [groupId] INT NOT NULL,
    [shift] NVARCHAR(1000) NOT NULL,
    [venderId] INT NOT NULL,
    [controlLotId] INT NOT NULL,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [qtyBox] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [HeaderReceiveTemp_status_df] DEFAULT 'use',
    CONSTRAINT [HeaderReceiveTemp_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Box] (
    [id] INT NOT NULL IDENTITY(1,1),
    [issueId] INT NOT NULL,
    [receiveId] INT,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [wosNo] NVARCHAR(1000) NOT NULL,
    [dwg] NVARCHAR(1000),
    [dieNo] NVARCHAR(1000) NOT NULL,
    [qty] INT NOT NULL,
    [BoxState] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Box_status_df] DEFAULT 'use',
    CONSTRAINT [Box_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BoxIssueTemp] (
    [id] INT NOT NULL IDENTITY(1,1),
    [headerId] INT NOT NULL,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [wosNo] NVARCHAR(1000) NOT NULL,
    [dwg] NVARCHAR(1000),
    [dieNo] NVARCHAR(1000) NOT NULL,
    [qty] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [BoxIssueTemp_status_df] DEFAULT 'use',
    CONSTRAINT [BoxIssueTemp_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BoxReceiveTemp] (
    [id] INT NOT NULL IDENTITY(1,1),
    [headerId] INT NOT NULL,
    [itemNo] NVARCHAR(1000) NOT NULL,
    [itemName] NVARCHAR(1000) NOT NULL,
    [wosNo] NVARCHAR(1000) NOT NULL,
    [dwg] NVARCHAR(1000),
    [dieNo] NVARCHAR(1000) NOT NULL,
    [lotNo] NVARCHAR(1000) NOT NULL,
    [qty] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [BoxReceiveTemp_status_df] DEFAULT 'use',
    CONSTRAINT [BoxReceiveTemp_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[HeaderIssue] ADD CONSTRAINT [HeaderIssue_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderIssue] ADD CONSTRAINT [HeaderIssue_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderIssueTemp] ADD CONSTRAINT [HeaderIssueTemp_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderIssueTemp] ADD CONSTRAINT [HeaderIssueTemp_venderId_fkey] FOREIGN KEY ([venderId]) REFERENCES [dbo].[Vendor]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderIssueTemp] ADD CONSTRAINT [HeaderIssueTemp_controlLotId_fkey] FOREIGN KEY ([controlLotId]) REFERENCES [dbo].[ControlLot]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderIssueTemp] ADD CONSTRAINT [HeaderIssueTemp_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderReceive] ADD CONSTRAINT [HeaderReceive_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderReceive] ADD CONSTRAINT [HeaderReceive_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderReceiveTemp] ADD CONSTRAINT [HeaderReceiveTemp_groupId_fkey] FOREIGN KEY ([groupId]) REFERENCES [dbo].[Group]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderReceiveTemp] ADD CONSTRAINT [HeaderReceiveTemp_venderId_fkey] FOREIGN KEY ([venderId]) REFERENCES [dbo].[Vendor]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderReceiveTemp] ADD CONSTRAINT [HeaderReceiveTemp_controlLotId_fkey] FOREIGN KEY ([controlLotId]) REFERENCES [dbo].[ControlLot]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[HeaderReceiveTemp] ADD CONSTRAINT [HeaderReceiveTemp_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Box] ADD CONSTRAINT [Box_issueId_fkey] FOREIGN KEY ([issueId]) REFERENCES [dbo].[HeaderIssue]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[BoxIssueTemp] ADD CONSTRAINT [BoxIssueTemp_headerId_fkey] FOREIGN KEY ([headerId]) REFERENCES [dbo].[HeaderIssueTemp]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[BoxReceiveTemp] ADD CONSTRAINT [BoxReceiveTemp_headerId_fkey] FOREIGN KEY ([headerId]) REFERENCES [dbo].[HeaderReceiveTemp]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

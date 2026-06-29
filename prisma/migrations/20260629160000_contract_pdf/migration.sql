-- Signed contract PDF (stored bytes served behind the contract-read gate)
ALTER TABLE "contracts" ADD COLUMN "pdfKey" TEXT;
ALTER TABLE "contracts" ADD COLUMN "pdfName" TEXT;

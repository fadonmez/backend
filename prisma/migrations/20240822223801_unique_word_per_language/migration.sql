/*
  Warnings:

  - A unique constraint covering the columns `[languageCode,wordName]` on the table `Word` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Word_wordName_key";

-- DropIndex
DROP INDEX "unique_word_per_language";

-- CreateIndex
CREATE UNIQUE INDEX "Word_languageCode_wordName_key" ON "Word"("languageCode", "wordName");

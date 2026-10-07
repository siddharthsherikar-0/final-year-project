-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Model" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "vertexCount" INTEGER,
    "triangleCount" INTEGER,
    "hasTextures" BOOLEAN NOT NULL DEFAULT false,
    "hasAnimations" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "author" TEXT,
    "license" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Model_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Model" ("author", "category", "createdAt", "description", "fileSize", "fileUrl", "format", "hasAnimations", "hasTextures", "id", "license", "name", "tags", "thumbnailUrl", "triangleCount", "updatedAt", "vertexCount") SELECT "author", "category", "createdAt", "description", "fileSize", "fileUrl", "format", "hasAnimations", "hasTextures", "id", "license", "name", "tags", "thumbnailUrl", "triangleCount", "updatedAt", "vertexCount" FROM "Model";
DROP TABLE "Model";
ALTER TABLE "new_Model" RENAME TO "Model";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

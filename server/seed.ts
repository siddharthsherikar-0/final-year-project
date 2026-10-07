import { prisma } from './prisma';

async function main() {
  const models = [
    {
      id: 'sample-duck',
      name: 'Duck',
      description: 'A classic sample 3D duck model. Perfect for testing the viewer.',
      category: 'characters',
      format: 'glb',
      fileUrl: '/models/duck.glb',
      thumbnailUrl: '/models/duck-thumb.png',
      fileSize: 120484,
      vertexCount: 2399,
      triangleCount: 4212,
      hasTextures: true,
      hasAnimations: false,
      tags: JSON.stringify(['sample', 'test', 'bird']),
      author: 'Khronos Group',
      license: 'CC0',
    },
    {
      id: 'sample-box',
      name: 'Box',
      description: 'A simple geometric box model. Great for basic rendering tests.',
      category: 'other',
      format: 'glb',
      fileUrl: '/models/box.glb',
      thumbnailUrl: '/models/box-thumb.png',
      fileSize: 1664,
      vertexCount: 24,
      triangleCount: 12,
      hasTextures: false,
      hasAnimations: false,
      tags: JSON.stringify(['sample', 'test', 'geometry']),
      author: 'Khronos Group',
      license: 'CC0',
    },
    {
      id: 'sample-cesium-man',
      name: 'Cesium Man',
      description: 'A humanoid character model with animations. Good for testing complex geometry.',
      category: 'characters',
      format: 'glb',
      fileUrl: '/models/cesium-man.glb',
      thumbnailUrl: '/models/cesium-man-thumb.png',
      fileSize: 490956,
      vertexCount: 12036,
      triangleCount: 24064,
      hasTextures: true,
      hasAnimations: true,
      tags: JSON.stringify(['sample', 'character', 'animated']),
      author: 'Cesium',
      license: 'CC0',
    },
    {
      id: 'sample-duck-2',
      name: 'Duck (Alt)',
      description: 'An alternative duck model variant for comparison.',
      category: 'characters',
      format: 'glb',
      fileUrl: '/models/duck-2.glb',
      thumbnailUrl: '/models/duck-2-thumb.png',
      fileSize: 120484,
      vertexCount: 2399,
      triangleCount: 4212,
      hasTextures: true,
      hasAnimations: false,
      tags: JSON.stringify(['sample', 'test', 'bird']),
      author: 'Khronos Group',
      license: 'CC0',
    },
  ];

  for (const model of models) {
    await prisma.model.upsert({
      where: { id: model.id },
      update: model,
      create: model,
    });
  }

  console.log(`Seeded ${models.length} models`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

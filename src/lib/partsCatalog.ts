export interface PartsCatalogItem {
  id: string
  name: string
  specs: string[]
  imageId: string
  defaultUnitPrice: number
}

export const PARTS_CATALOG: PartsCatalogItem[] = [
  {
    id: 'oven-pan-single',
    name: 'Oven pan (For single conveyor models)',
    specs: [
      '457(W) x 328(D) x 25(H) mm',
      'Sumiflon-coated pan',
      '657(W) x 456(D) x 25(H) mm (for 5W models)',
      'Sumiflon-coated pan',
    ],
    imageId: 'oven-pan-dark',
    defaultUnitPrice: 0,
  },
  {
    id: 'oven-pan-twin',
    name: 'Oven pan (For twin conveyor models)',
    specs: ['210(W) x 150(D) x 30(H) mm'],
    imageId: 'oven-pan-deep',
    defaultUnitPrice: 0,
  },
  {
    id: 'grooved-pan-657',
    name: 'Grooved pan',
    specs: ['657(W) x 456(D) x 25(H) mm (for 5W models)', 'Sumiflon-coated pan'],
    imageId: 'grooved-pan-blue',
    defaultUnitPrice: 0,
  },
  {
    id: 'grooved-pan-single-twin',
    name: 'Grooved pan',
    specs: [
      '457(W) x 328(D) x 25(H) mm (for single conveyor models)',
      '210(W) x 150(D) x 30(H) mm (for twin conveyor models)',
      'Sumiflon-coated pan',
    ],
    imageId: 'grooved-pan-blue-alt',
    defaultUnitPrice: 0,
  },
  {
    id: 'curved-grid',
    name: 'Curved grid',
    specs: ['300-type: 400(W) x 400(D) x 40(H) mm', '500-type: 400(W) x 400(D) x 60(H) mm'],
    imageId: 'curved-grid',
    defaultUnitPrice: 0,
  },
  {
    id: 'flat-grid-single',
    name: 'Flat grid (For single conveyor models)',
    specs: [
      '429(W) x 290(D) x 30(H) mm',
      '490(W) x 359(D) x 30(H) mm',
      '615(W) x 405(D) x 30(H) mm (for 5W models)',
      '670(W) x 450(D) x 30(H) mm (for 5W models)',
    ],
    imageId: 'flat-grid-wide',
    defaultUnitPrice: 0,
  },
  {
    id: 'oven-pan-657',
    name: 'Oven pan',
    specs: ['657(W) x 456(D) x 25(H) mm', 'Sumiflon-coated pan'],
    imageId: 'oven-pan-dark-alt',
    defaultUnitPrice: 0,
  },
  {
    id: 'grooved-pan-657-second',
    name: 'Grooved pan',
    specs: ['657(W) x 456(D) x 25(H) mm', 'Sumiflon-coated pan'],
    imageId: 'grooved-pan-blue',
    defaultUnitPrice: 0,
  },
  {
    id: 'flat-grid-long',
    name: 'Flat grid',
    specs: ['670(W) x 450(D) x 30(H) mm', '615(W) x 405(D) x 30(H) mm'],
    imageId: 'flat-grid-alt',
    defaultUnitPrice: 0,
  },
]

// O pacote "pdfmake" não publica tipos próprios compatíveis com o modo de
// importação usado aqui (build dos arquivos client-side). Declaramos os
// módulos como "any" para não travar o `tsc --noEmit` do CI.
declare module 'pdfmake/build/pdfmake' {
  const pdfMake: any;
  export default pdfMake;
}

declare module 'pdfmake/build/vfs_fonts' {
  const vfs: any;
  export default vfs;
}

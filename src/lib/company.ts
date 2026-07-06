/** Single source for the maker's brand — never hardcode these strings in pages. */
export const COMPANY_NAME = 'Byte Dynamo';
export const PRODUCT_NAME = 'MediPOS';
export const copyrightLine = () => `© ${new Date().getFullYear()} ${COMPANY_NAME}`;
/** Receipt/invoice byline for non-white-label tenants. */
export const poweredByLine = `${PRODUCT_NAME} · © ${COMPANY_NAME}`;

const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post('/generate_invoice', async (req, res) => {
  const { building } = req.body;

  // Generate HTML content for the invoice
  const {invoiceHtml, pageMultilang, of} = generateInvoiceHTML(building);

  // Convert HTML to PDF using Puppeteer
  const buffer = await generatePDF(invoiceHtml, pageMultilang, of);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
  res.send(buffer);
});

async function generatePDF(html, pageMultilang, of) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html)
  const buffer = await page.pdf({
    format: 'A4',
    margin: { top: 25, bottom: 40 },
    displayHeaderFooter: true,
    scale: 1.25,
    footerTemplate: `
    <p style="display:block; margin: auto; font-size: 10px; margin-top: 40px; font-family: 'Inter'">
      ${pageMultilang} <span class="pageNumber"></span>
        ${of}
      <span class="totalPages"></span>
    </p>
    `
  });

  await browser.close();

  return buffer;
}

function formatNumber(number) {
  // Check if the number is a round number
  const isRound = Number.isInteger(number);

  // Convert number to a string
  let formattedNumber = number?.toString() ?? '0';

  // Split the number into integer and decimal parts
  const parts = formattedNumber.split('.');

  // Format the integer part with commas for thousands
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // If there is a decimal part, format it
  if (parts[1]) {
    // Pad the decimal part with zeros if it has only one digit
    parts[1] = ',' + (parts[1].length === 1 ? parts[1] + '0' : parts[1]);
  } else {
    // If the number is round, add ',00' for round numbers
    parts[1] = isRound ? ',00' : '';
  }

  // Join the integer and decimal parts and return the formatted number
  formattedNumber = parts.join('');

  return formattedNumber;
}

function isEmptyOrNull(value) {
  return value === undefined || value === null || value === "";
}

function generateAllocationsTable(allocations, empty_distribution_multilang) {
  let res = '';
  const groupByDistributionKey = allocations.reduce((accumulator, currentValue) => {
    const key = isEmptyOrNull(currentValue.distribution_key_name)
    ? "undefined"
    : currentValue.distribution_key_name;
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(currentValue);
    return accumulator;
  }, {})

  for (const key in groupByDistributionKey) {
    if (Object.hasOwnProperty.call(groupByDistributionKey, key)) {
      const arrayForCurrentKey = groupByDistributionKey[key];
      const distribution_name = key !== 'undefined' ? key : empty_distribution_multilang
      res += `
        <tr>
          <td colspan = '6'>
            ${distribution_name}
          </td>
        </tr>
      `
      for (const item of arrayForCurrentKey) {
        res += `
        <tr>
            <td style="width: 80px; vertical-align: top; line-height: 10px; font-family: 'IBM Plex Sans'" align="left">${item.invoice_date}</td>
            <td style="width: 76px; vertical-align: top; line-height: 10px; font-family: 'IBM Plex Sans'" align="left">${item.invoice_number}</td>
            <td style="width: 76px; vertical-align: top; word-wrap: break-word; line-height: 10px; font-family: 'Inter'" align="left">${item.supplier_name}</td>
            <td style="width: 140px; vertical-align: top; word-wrap: break-word; line-height: 10px; font-family: 'Inter'" align="left">${item.description}</td>
            <td style="width: 72px; vertical-align: top; padding-right: 8px; line-height: 10px; font-family: 'IBM Plex Sans'" align="right">&euro;${formatNumber(item.vat_amount)}</td>
            <td style="width: 72px; vertical-align: top; padding-left: 4px; line-height: 10px; font-family: 'IBM Plex Sans'" align="right" >&euro;${formatNumber(item.total)}</td>
        </tr>
        `;        
      }
    }
  }
  return res;
}

function generateInvoiceContent(ledgers, empty_distribution_multilang) {
  let res = '';
  for (const ledger of ledgers) {
    const code = ledger.code;
    const name = ledger.name;
    const total = ledger.total;
    const total_vat = ledger.total_vat

    res += `
      <tr>
          <td colspan="6" style="font-weight: 600; font-family: 'Inter'">
              ${code} - ${name}
          </td>
      </tr>
      `;

    const allocations = ledger.cost_allocations;
    const allocationsTable = generateAllocationsTable(allocations, empty_distribution_multilang);
    res += allocationsTable;
    res += `
        <tr>
            <td style="width: 80px; border-top: 1px solid rgba(0, 0, 0, 0.1); vertical-align: top; line-height: 10px; font-family: 'IBM Plex Sans'" align="left"></td>
            <td style="width: 76px; border-top: 1px solid rgba(0, 0, 0, 0.1); vertical-align: top; line-height: 10px; font-family: 'IBM Plex Sans'" align="left"></td>
            <td style="width: 76px; border-top: 1px solid rgba(0, 0, 0, 0.1); vertical-align: top; word-wrap: break-word; line-height: 10px; font-family: 'Inter'" align="left"></td>
            <td style="width: 140px; border-top: 1px solid rgba(0, 0, 0, 0.1); vertical-align: top; word-wrap: break-word; line-height: 10px; font-family: 'Inter'" align="left"></td>
            <td style="width: 72px; border-top: 1px solid rgba(0, 0, 0, 0.1); vertical-align: top; padding-right: 8px; line-height: 10px; font-family: 'IBM Plex Sans'" align="right">&euro;${formatNumber(total_vat)}</td>
            <td style="width: 72px; border-top: 1px solid rgba(0, 0, 0, 0.1); vertical-align: top; padding-left: 4px; line-height: 10px; font-family: 'IBM Plex Sans'" align="right" >&euro;${formatNumber(total)}</td>
        </tr>
        `;    
  }
  return res;
}

function mapMultilangue(language) {
  const multilanguage = {
    "EN": {
      date: 'Date',
      description: 'Description',
      contact_supplier: 'Supplier',
      invoice_total_short: 'Total',
      page: 'Page',
      of : 'of',
      invoice_number_short: 'Invoice no.',
      vat_percentage: 'VAT',
      empty_distribution_multilang: 'No distribution key'
    },
    "NL": {
      date: 'Datum',
      description: 'Omschrijving',
      contact_supplier: 'Leverancier',
      invoice_total_short: 'Totaal',
      page: 'Pagina',
      of : 'van',
      invoice_number_short: 'Factuurnr.',
      vat_percentage: 'BTW',
      empty_distribution_multilang: 'Geen verdeelsleutel'
    },
    "FR": {
      date: 'Date',
      description: 'Description',
      contact_supplier: 'Fournisseur',
      invoice_total_short: 'Total',
      page: 'Page',
      of : 'sur',
      invoice_number_short: 'Facture no.',
      vat_percentage: 'TVA',
      empty_distribution_multilang: 'Pas de clé de distribution'
    },
    "DE": {
      date: 'Datum',
      description: 'Beschreibung',
      contact_supplier: ':Lieferant',
      invoice_total_short: 'Gesamt',
      page: 'Seite',
      of : 'von',
      invoice_number_short: 'Rechnungsnr.',
      vat_percentage: 'MwSt',
      empty_distribution_multilang: 'Kein Verteilungsschlüssel'
    },
  }
  return multilanguage[language]
}

function generateInvoiceHTML(building) {
  const {
    name: building_name,
    company_number,
    address_line_1,
    address_line_2,
    date_start,
    date_end,
    sum_total_amount,
    sum_vat_amount,
    export_date,
    ledgers,
    language
  } = building

  const { date, description, contact_supplier, invoice_total_short, 
          page, of, invoice_number_short, vat_percentage, empty_distribution_multilang } = mapMultilangue(language)

  const content = generateInvoiceContent(ledgers, empty_distribution_multilang)

  const invoiceHTML = `
  <html>
  <style>
    @import url(https://fonts.googleapis.com/css?family=Inter)
    @import url(https://fonts.googleapis.com/css?family=IBM Plex Sans)
    @page {
      margin: 15px;
    }
    body {
      font-family: 'Inter';
    }
    /* cyrillic-ext */
    @font-face {
      font-family: 'IBM Plex Sans';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdzeFb5N.woff2) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* cyrillic */
    @font-face {
      font-family: 'IBM Plex Sans';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdXeFb5N.woff2) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
    /* greek */
    @font-face {
      font-family: 'IBM Plex Sans';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdLeFb5N.woff2) format('woff2');
      unicode-range: U+0370-03FF;
    }
    /* vietnamese */
    @font-face {
      font-family: 'IBM Plex Sans';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhd7eFb5N.woff2) format('woff2');
      unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
    }
    /* latin-ext */
    @font-face {
      font-family: 'IBM Plex Sans';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhd_eFb5N.woff2) format('woff2');
      unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: 'IBM Plex Sans';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdHeFQ.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* cyrillic-ext */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZJhiI2B.woff2) format('woff2');
      unicode-range: U+0460-052F, U+1C80-1C88, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F;
    }
    /* cyrillic */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZthiI2B.woff2) format('woff2');
      unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116;
    }
    /* greek-ext */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZNhiI2B.woff2) format('woff2');
      unicode-range: U+1F00-1FFF;
    }
    /* greek */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZxhiI2B.woff2) format('woff2');
      unicode-range: U+0370-03FF;
    }
    /* vietnamese */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZBhiI2B.woff2) format('woff2');
      unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB;
    }
    /* latin-ext */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZFhiI2B.woff2) format('woff2');
      unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 400;
      src: url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
  </style>
  <body style="display: flex; justify-content: center; align-items: center">
    <div style="margin: 10px; width: 595px; height: 842px" className='invoice'>
      <div
        style="
          display: flex;
          display: -webkit-flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          line-height: 16px;
          word-wrap: break-word;
          font-size: 11px;
          font-family: Inter;
          justify-content: space-between;
          -ms-flex-pack: justify;
        "
      >
        <div>
          <div style="display: -webkit-box; display: -webkit-flex">
            <div style="width: 33%" align="left">
              <p style="font-weight: 600; margin: 4px 0">${building_name}</p>
              <p style="margin: 4px 0">${company_number}</p>
              <p style="margin: 4px 0">${address_line_1}</p>
              <p style="margin: 4px 0">${address_line_2}</p>
            </div>
            <div style="width: 33%" align="center">
              <p style="font-weight: 600; margin: 4px 0">Facturenlijst - grootboekrekening</p>
              <p style="margin: 4px 0">${date_start} - ${date_end}</p>
            </div>
            <div style="width: 33%" align="right">
              <p style="font-weight: 600; margin: 4px 0">${export_date}</p>
            </div>
          </div>
          <div>
            <table
              style="
                width: 100%;
                border: 0;
                border-spacing: 0px 8px;
                line-height: 16px;
                word-wrap: break-word;
                font-size: 11px;
                font-family: Inter;
              "
            >
              <!--column header-->
              <tr>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: 600;
                  "
                  align="left"
                >
                  ${date}
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="left"
                >
                  ${invoice_number_short}
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="left"
                >
                  ${contact_supplier}
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    padding-right: 8px;
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="left"
                >
                  ${description}
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    width: 72px;
                    padding-right: 8px;
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="right"
                >
                  ${vat_percentage}
                </td>
                <td
                  style="
                    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
                    width: 72px;
                    padding-left: 4px;
                    font-weight: 600;
                    font-family: 'Inter';
                  "
                  align="right"
                >
                  ${invoice_total_short}
                </td>
              </tr>
              ${content}
            </table>
          </div>
        </div>
        <div>
          <table
            style="
              width: 100%;
              margin-top: 16px;
              border: 0;
              border-spacing: 0px 8px;
              line-height: 16px;
              word-wrap: break-word;
              font-size: 11px;
              font-family: Inter;
            "
          >
            <!--footer-->
            <tr>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  padding-right: 8px;
                  font-weight: 600;
                "
                align="left"
              >
                Totaal
              </td>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  width: 72px;
                  padding-right: 8px;
                  font-weight: 600;
                  font-family: 'IBM Plex Sans'
                "
                align="right"
              >
                &euro;${formatNumber(sum_vat_amount)}
              </td>
              <td
                style="
                  border-top: 1px solid rgba(0, 0, 0, 0.1);
                  width: 72px;
                  padding-left: 4px;
                  font-weight: 600;
                  font-family: 'IBM Plex Sans'
                "
                align="right"
              >
                &euro;${formatNumber(sum_total_amount)}
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </body>
</html>
    `;

  return {invoiceHtml: invoiceHTML, pageMultilang: page, of: of};
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

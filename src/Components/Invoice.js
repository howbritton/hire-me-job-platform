import React from 'react';
import { PDFDownloadLink, Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import logo from '../assets/hireme-logo.png';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40
  },
  logo: { 
    width: 120,
    marginBottom: 20
  },
  companyInfo: {
    fontSize: 10,
    textAlign: 'right'
  },
  title: {
    fontSize: 24,
    marginBottom: 30,
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold'
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 5,
    fontFamily: 'Helvetica-Bold'
  },
  text: {
    fontSize: 10,
    lineHeight: 1.5,
    fontFamily: 'Helvetica'
  },
  boldText: {
    fontSize: 10,
    lineHeight: 1.5,
    fontFamily: 'Helvetica-Bold'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  packageDetails: {
    marginTop: 20,
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f8f8f8'
  },
  total: {
    marginTop: 30,
    borderTopWidth: 1,
    paddingTop: 10
  },
  totalText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold'
  },
  footer: {
    marginTop: 40,
    textAlign: 'center',
    fontSize: 10,
    color: '#666'
  }
});

const generateInvoiceNumber = (date, id) => {
  const year = date.getFullYear().toString().substr(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const sequence = id.substr(-3).toUpperCase();
  return `${year}${month}-${sequence}`;
};

const InvoiceDocument = ({ data }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Image style={styles.logo} src={logo} />
          <Text style={styles.text}>20A South Avenue, Kingston, Jamaica</Text>
          <Text style={styles.text}>info@hiremeja.com</Text>
          <Text style ={styles.text}>Customer Service number: +1 (876) 425-8529</Text>
        </View>
        <View style={styles.companyInfo}>
          <Text style={styles.boldText}>Invoice #: {generateInvoiceNumber(data.date, data.id)}</Text>
          <Text style={styles.boldText}>Date: {data.date.toLocaleDateString()}</Text>
        </View>
      </View>

      <Text style={styles.title}>INVOICE</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bill To:</Text>
        <Text style={styles.text}>Company: <Text style={styles.boldText}>
          {data.profile?.companyName || data.companyName}
        </Text></Text>
        <Text style={styles.text}>Contact: <Text style={styles.boldText}>
          {data.profile?.firstName ? `${data.profile.firstName} ${data.profile.lastName}` : data.employerName}
        </Text></Text>
        <Text style={styles.text}>Email: <Text style={styles.boldText}>
          {data.profile?.email || data.employerEmail}
        </Text></Text>
        <Text style={styles.text}>Phone: <Text style={styles.boldText}>
          {data.profile?.phone || data.phone || 'N/A'}
        </Text></Text>
      </View>

      <View style={styles.packageDetails}>
        <Text style={styles.sectionTitle}>Package Details</Text>
        <View style={styles.row}>
          <Text style={styles.boldText}>Package Name</Text>
          <Text style={styles.boldText}>Amount</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.text}>{data.packageName}</Text>
          <Text style={styles.text}>USD${parseFloat(data.amount).toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.total}>
        <View style={styles.row}>
          <Text style={styles.boldText}>Payment Method:</Text>
          <Text style={styles.text}>
            {data.paymentMethod ? 
              data.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
              'Bank Transfer'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.boldText}>Total Amount:</Text>
          <Text style={styles.boldText}>USD${parseFloat(data.amount).toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.text}>Thank you for your business. Please retain a copy of this receipt for their records</Text>
      </View>
    </Page>
  </Document>
);

const Invoice = ({ data }) => (
  <PDFDownloadLink
    document={<InvoiceDocument data={data} />}
    fileName={`invoice-${generateInvoiceNumber(data.date, data.id)}.pdf`}
    className="text-blue-600 hover:text-blue-800"
  >
    {({ loading }) => (loading ? 'Generating invoice...' : 'Download Invoice')}
  </PDFDownloadLink>
);

export { Invoice };
export default Invoice;
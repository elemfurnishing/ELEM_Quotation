/**
 * QuotationPDF Component
 * 
 * Generates a professional PDF quotation matching the exact ELEM brand design.
 * Footer "Thank You!" and "Powered By Botovate" always appears at the bottom of each page.
 */

import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import html2pdf from 'html2pdf.js';
import { X, Download, Loader2 } from 'lucide-react';

// Helper function to convert Google Drive URLs to displayable thumbnail format
const getDisplayableImageUrl = (url) => {
    if (!url || typeof url !== 'string') return null;

    try {
        const directMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (directMatch && directMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${directMatch[1]}&sz=w400`;
        }

        const ucMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (ucMatch && ucMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w400`;
        }

        const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
        if (openMatch && openMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w400`;
        }

        if (url.includes("thumbnail?id=")) {
            return url;
        }

        const anyIdMatch = url.match(/([a-zA-Z0-9_-]{25,})/);
        if (anyIdMatch && anyIdMatch[1]) {
            return `https://drive.google.com/thumbnail?id=${anyIdMatch[1]}&sz=w400`;
        }

        return url;
    } catch (e) {
        return url;
    }
};

const QuotationPDF = ({ isOpen, onClose, quotation }) => {
    const pdfRef = useRef(null);
    const [generating, setGenerating] = useState(false);
    const [imageCache, setImageCache] = useState({});
    const [imagesLoaded, setImagesLoaded] = useState(false);

    // Try loading image via canvas (bypasses some CORS issues)
    const loadImageViaCanvas = (url, timeout = 5000) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            const timeoutId = setTimeout(() => {
                resolve(null);
            }, timeout);

            img.onload = () => {
                clearTimeout(timeoutId);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || 100;
                    canvas.height = img.naturalHeight || 100;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(base64);
                } catch (e) {
                    resolve(null);
                }
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                resolve(null);
            };

            img.src = url;
        });
    };

    // Fast image loader with multiple fallbacks
    const loadImageWithTimeout = async (url, timeout = 5000) => {
        const proxyUrls = [
            url,
            `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=100&h=100`,
            `https://corsproxy.io/?${encodeURIComponent(url)}`,
        ];

        for (const proxyUrl of proxyUrls) {
            try {
                const base64 = await loadImageViaCanvas(proxyUrl, 3000);
                if (base64 && base64.length > 100) {
                    return base64;
                }
            } catch (e) {
                continue;
            }
        }

        return null;
    };

    const blobToBase64 = (blob) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    };

    useEffect(() => {
        if (isOpen && quotation?.items) {
            setImagesLoaded(false);

            const loadImages = async () => {
                const cache = {};

                try {
                    const logoResponse = await fetch('/logo.png');
                    const logoBlob = await logoResponse.blob();
                    cache['logo'] = await blobToBase64(logoBlob);
                } catch (e) { }

                const imagePromises = quotation.items.map(async (item, i) => {
                    const imageUrl = getDisplayableImageUrl(item.imagePreview);
                    if (imageUrl) {
                        const base64 = await loadImageWithTimeout(imageUrl, 3000);
                        if (base64) {
                            return { key: `item_${i}`, value: base64 };
                        }
                    }
                    return null;
                });

                const results = await Promise.all(imagePromises);
                results.forEach(result => {
                    if (result) {
                        cache[result.key] = result.value;
                    }
                });

                setImageCache(cache);
                setImagesLoaded(true);
            };

            loadImages();
        }
    }, [isOpen, quotation]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen || !quotation) return null;

    const { serialNo, date, customer, items = [], totalAmount } = quotation;

    const formatDate = (dateString) => {
        if (!dateString) return new Date().toLocaleDateString('en-GB');
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const handleDownloadPDF = async () => {
        setGenerating(true);

        if (!imagesLoaded) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const element = pdfRef.current;

        const opt = {
            margin: [0, 0, 25, 0], // Top (0), Left, Bottom (25mm for footer), Right - header goes to top
            filename: `Quotation_${serialNo || 'ELEM'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 }, // High quality JPEG
            html2canvas: {
                scale: 4, // High resolution for crisp zoom
                useCORS: true,
                allowTaint: true,
                logging: false,
                windowWidth: 794,
                letterRendering: true,
                scrollY: 0,
                scrollX: 0,
                imageTimeout: 15000,
                removeContainer: true
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true, // Keep file size manageable
                putOnlyUsedFonts: true,
                precision: 16 // Better positioning precision
            },
            pagebreak: {
                mode: ['css', 'legacy'],
                before: '.page-break-before',
                after: '.page-break-after',
                avoid: ['.avoid-break', '.item-row']
            }
        };

        try {
            // Generate PDF with html2pdf, then add footer to each page
            const pdfInstance = html2pdf().set(opt).from(element);

            await pdfInstance.toPdf().get('pdf').then((pdf) => {
                const totalPages = pdf.internal.getNumberOfPages();
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                // Add footer only to the LAST page
                pdf.setPage(totalPages);

                // Footer background (beige color) - 25mm height
                pdf.setFillColor(217, 208, 195); // #d9d0c3
                pdf.rect(0, pageHeight - 25, pageWidth, 25, 'F');

                // Thank you! text
                pdf.setFont('times', 'normal');
                pdf.setFontSize(20);
                pdf.setTextColor(90, 90, 90); // #5a5a5a
                pdf.text('Thank you!', pageWidth / 2, pageHeight - 13, { align: 'center' });

                // Powered By Botovate text
                pdf.setFontSize(8);
                pdf.text('Powered By Botovate', pageWidth / 2, pageHeight - 5, { align: 'center' });
            }).save();

        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setGenerating(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl max-h-[95vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">

                {/* Modal Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#052e25] text-white">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold">PDF Preview</h2>
                        {!imagesLoaded && (
                            <span className="text-xs text-yellow-300 flex items-center gap-1">
                                <Loader2 size={12} className="animate-spin" /> Loading images...
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={generating || !imagesLoaded}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {generating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {!imagesLoaded ? 'Loading...' : generating ? 'Generating...' : 'Download PDF'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* PDF Content - Preview (footer shown in preview) */}
                <div className="flex-1 overflow-auto bg-gray-200 p-4">
                    <div
                        ref={pdfRef}
                        style={{
                            width: '210mm',
                            margin: '0 auto',
                            backgroundColor: '#fff',
                            fontFamily: 'Georgia, "Times New Roman", serif',
                            fontSize: '12px',
                            color: '#4a4a4a',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
                        }}
                    >
                        {/* Header - Full Width */}
                        <div style={{
                            backgroundColor: '#d9d0c3',
                            padding: '25px 40px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}>
                            <div>
                                <h1 style={{
                                    fontSize: '48px',
                                    fontWeight: 'bold',
                                    color: '#4a4a4a',
                                    margin: '0',
                                    letterSpacing: '10px',
                                    fontFamily: 'Georgia, serif',
                                    fontStyle: 'italic'
                                }}>ELEM</h1>
                                <p style={{
                                    fontSize: '13px',
                                    color: '#5a5a5a',
                                    letterSpacing: '4px',
                                    margin: '8px 0 0 0',
                                    fontFamily: 'Georgia, serif',
                                    textTransform: 'uppercase'
                                }}>CRAFTED FOR ELEGANCE</p>
                            </div>
                            <img src={imageCache['logo'] || '/logo.png'} alt="ELEM" style={{ height: '65px', objectFit: 'contain' }} />
                        </div>

                        {/* Main Content */}
                        <div style={{ padding: '0 35px' }}>

                            {/* Bill To Section */}
                            <div className="avoid-break" style={{
                                padding: '15px 0',
                                borderBottom: '1px solid #e0e0e0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start'
                            }}>
                                <div>
                                    <p style={{ fontWeight: 'bold', color: '#5a5a5a', marginBottom: '6px', fontSize: '12px' }}>BILL TO:</p>
                                    <p style={{ margin: '3px 0', color: '#444', fontSize: '11px' }}><strong>Name :-</strong> {customer?.name || 'N/A'}</p>
                                    <p style={{ margin: '3px 0', color: '#444', fontSize: '11px' }}><strong>Phone No.:-</strong> {customer?.phone || 'N/A'}</p>
                                    <p style={{ margin: '3px 0', color: '#444', fontSize: '11px' }}><strong>Email :-</strong> {customer?.email || 'N/A'}</p>
                                </div>
                                <div style={{ textAlign: 'right', color: '#666', fontSize: '11px', maxWidth: '50%' }}>
                                    <p style={{ margin: '3px 0' }}>Date: {formatDate(date)}</p>
                                    <p style={{ margin: '3px 0' }}>Invoice NO. {serialNo || 'N/A'}</p>
                                    <p style={{ margin: '3px 0', color: '#444' }}><strong>Address:-</strong> {customer?.address || 'N/A'}</p>
                                </div>
                            </div>

                            {/* From Section */}
                            <div className="avoid-break" style={{
                                padding: '12px 0',
                                borderBottom: '1px solid #e0e0e0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start'
                            }}>
                                <div>
                                    <p style={{ fontWeight: 'bold', color: '#333', fontSize: '12px', margin: '0 0 4px 0' }}>
                                        FROM: ELEM
                                    </p>
                                    <p style={{ color: '#333', fontSize: '11px', margin: '0' }}>
                                        <strong>Mobile No:</strong> 7599999650
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right', maxWidth: '50%' }}>
                                    <p style={{ color: '#333', fontSize: '11px', lineHeight: '1.5', margin: '0' }}>
                                        <strong>Address:-</strong> Fruit Market, Ahead Lalpur,<br />
                                        beside Bharat Petroleum, Pachpedi<br />
                                        Naka, Raipur, Chhattisgarh 492015
                                    </p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div style={{ padding: '12px 0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #ccc' }}>
                                            <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 'bold', color: '#555', fontSize: '9px' }}>DESCRIPTION</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 'bold', color: '#555', fontSize: '9px', width: '50px' }}>QTY</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold', color: '#555', fontSize: '9px', width: '80px' }}>PRICE</th>
                                            <th style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 'bold', color: '#555', fontSize: '9px', width: '80px' }}>TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => {
                                            const qty = parseFloat(item.qty) || 0;
                                            const price = parseFloat(item.price) || 0;
                                            const discount = parseFloat(item.discount) || 0;
                                            const subtotal = qty * price * (1 - discount / 100);
                                            const cachedImage = imageCache[`item_${index}`];

                                            return (
                                                <tr key={index} className="item-row avoid-break">
                                                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                                                        <div style={{ display: 'flex', gap: '10px' }}>
                                                            {cachedImage ? (
                                                                <img
                                                                    src={cachedImage}
                                                                    alt=""
                                                                    style={{
                                                                        width: '55px',
                                                                        height: '55px',
                                                                        objectFit: 'cover',
                                                                        borderRadius: '3px',
                                                                        border: '1px solid #ddd',
                                                                        backgroundColor: '#f5f5f5',
                                                                        flexShrink: 0
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div style={{
                                                                    width: '55px',
                                                                    height: '55px',
                                                                    borderRadius: '3px',
                                                                    border: '1px solid #ddd',
                                                                    backgroundColor: '#f0f0f0',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '7px',
                                                                    color: '#999',
                                                                    flexShrink: 0
                                                                }}>
                                                                    NO IMG
                                                                </div>
                                                            )}
                                                            <div style={{ flex: 1, fontSize: '9px', lineHeight: '1.5' }}>
                                                                <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#333', marginBottom: '3px' }}>
                                                                    {item.itemNo ? `#${item.itemNo} - ` : ''}{item.title || 'N/A'}
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', color: '#555' }}>
                                                                    {item.serialNumber && (
                                                                        <div><span style={{ color: '#888' }}>Item Code:</span> {item.serialNumber}</div>
                                                                    )}
                                                                    {item.modelNo && (
                                                                        <div><span style={{ color: '#888' }}>Model No:</span> {item.modelNo}</div>
                                                                    )}
                                                                    {item.size && (
                                                                        <div><span style={{ color: '#888' }}>Size:</span> {item.size}</div>
                                                                    )}
                                                                    {item.color && (
                                                                        <div><span style={{ color: '#888' }}>Color:</span> {item.color}</div>
                                                                    )}
                                                                </div>
                                                                {item.specification && (
                                                                    <div style={{ marginTop: '3px', color: '#555' }}>
                                                                        <span style={{ color: '#888' }}>Specification:</span> {item.specification}
                                                                    </div>
                                                                )}
                                                                {item.remarks && (
                                                                    <div style={{ marginTop: '2px', color: '#666', fontStyle: 'italic' }}>
                                                                        <span style={{ color: '#888' }}>Remarks:</span> {item.remarks}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #eee', textAlign: 'center', fontSize: '10px', verticalAlign: 'top' }}>{qty}</td>
                                                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #eee', textAlign: 'right', fontSize: '10px', verticalAlign: 'top' }}>{formatCurrency(price)}</td>
                                                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #eee', textAlign: 'right', fontSize: '10px', verticalAlign: 'top' }}>{formatCurrency(subtotal)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Total Amount */}
                                <div className="avoid-break" style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    marginTop: '12px',
                                    paddingTop: '8px',
                                    borderTop: '1px solid #333'
                                }}>
                                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginRight: '30px' }}>Total amount</span>
                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', padding: '6px 20px', border: '1px solid #333' }}>
                                        {formatCurrency(totalAmount)}
                                    </span>
                                </div>
                            </div>

                            {/* Terms & Conditions - Premium Design */}
                            <div className="avoid-break terms-section" style={{
                                padding: '20px 35px',
                                backgroundColor: '#f8f6f3',
                                marginLeft: '-35px',
                                marginRight: '-35px',
                                marginTop: '15px',
                                borderTop: '2px solid #d9d0c3',
                                borderBottom: '2px solid #d9d0c3'
                            }}>
                                {/* Terms Header */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: '12px',
                                    paddingBottom: '8px',
                                    borderBottom: '1px solid #e0dbd4'
                                }}>
                                    <div style={{
                                        width: '4px',
                                        height: '16px',
                                        backgroundColor: '#052e25',
                                        marginRight: '10px',
                                        borderRadius: '2px'
                                    }}></div>
                                    <h3 style={{
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        color: '#052e25',
                                        margin: 0,
                                        letterSpacing: '1px',
                                        textTransform: 'uppercase'
                                    }}>
                                        Terms & Conditions
                                    </h3>
                                </div>

                                {/* Terms List */}
                                {/* Terms List */}
                                <div style={{ margin: '0 0 15px 0', fontSize: '9px', color: '#555' }}>
                                    {[
                                        'Transportation & packing charges will be additional as per actuals',
                                        'Once order placed will not be cancelled',
                                        'Goods will not be returned once delivered'
                                    ].map((text, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '6px' }}>
                                            <span style={{
                                                width: '3px',
                                                height: '3px',
                                                backgroundColor: '#052e25',
                                                borderRadius: '50%',
                                                marginTop: '5px',
                                                marginRight: '10px',
                                                flexShrink: 0
                                            }}></span>
                                            <span style={{ lineHeight: '1.5' }}>{text}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Payment Terms Box */}
                                <div style={{
                                    backgroundColor: '#fff',
                                    padding: '10px 15px',
                                    borderRadius: '6px',
                                    border: '1px solid #e0dbd4',
                                    marginBottom: '15px',
                                    display: 'inline-block'
                                }}>
                                    <p style={{ margin: 0, fontSize: '10px', color: '#333' }}>
                                        <strong style={{ color: '#052e25' }}>PAYMENT TERMS:</strong>
                                        <span style={{ marginLeft: '10px' }}>50% at the time of booking and balance against delivery</span>
                                    </p>
                                </div>

                                {/* Bank Details & QR Code Row */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'stretch',
                                    gap: '20px'
                                }}>
                                    {/* Bank Details Card */}
                                    <div style={{
                                        flex: 1,
                                        backgroundColor: '#fff',
                                        padding: '15px',
                                        borderRadius: '8px',
                                        border: '1px solid #e0dbd4',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginBottom: '10px',
                                            paddingBottom: '8px',
                                            borderBottom: '1px solid #f0ebe4'
                                        }}>
                                            <div style={{
                                                width: '3px',
                                                height: '14px',
                                                backgroundColor: '#052e25',
                                                marginRight: '8px',
                                                borderRadius: '2px'
                                            }}></div>
                                            <p style={{
                                                fontWeight: 'bold',
                                                color: '#052e25',
                                                margin: 0,
                                                fontSize: '11px',
                                                letterSpacing: '0.5px'
                                            }}>BANK DETAILS</p>
                                        </div>
                                        <div style={{ fontSize: '9px', color: '#444', lineHeight: '1.8' }}>
                                            <p style={{ margin: '0 0 3px 0' }}><strong style={{ color: '#666' }}>Bank:</strong> HDFC BANK</p>
                                            <p style={{ margin: '0 0 3px 0' }}><strong style={{ color: '#666' }}>A/C Name:</strong> VP ENTERPRISES</p>
                                            <p style={{ margin: '0 0 3px 0' }}><strong style={{ color: '#666' }}>A/C No:</strong> 50200087610168</p>
                                            <p style={{ margin: 0 }}><strong style={{ color: '#666' }}>IFSC:</strong> HDFC0001280 (Pachpedinaka Branch, Raipur)</p>
                                        </div>
                                    </div>

                                    {/* UPI QR Code Card */}
                                    <div style={{
                                        backgroundColor: '#fff',
                                        padding: '12px 20px',
                                        borderRadius: '8px',
                                        border: '1px solid #e0dbd4',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                                        textAlign: 'center',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <p style={{
                                            fontWeight: 'bold',
                                            color: '#052e25',
                                            marginBottom: '8px',
                                            fontSize: '10px',
                                            letterSpacing: '1px',
                                            margin: '0 0 8px 0'
                                        }}>SCAN TO PAY</p>
                                        <div style={{
                                            padding: '6px',
                                            backgroundColor: '#fff',
                                            border: '2px solid #052e25',
                                            borderRadius: '6px',
                                            marginBottom: '8px'
                                        }}>
                                            <img
                                                src="/upi-qr-code.png"
                                                alt="UPI QR Code"
                                                style={{
                                                    width: '75px',
                                                    height: '75px',
                                                    objectFit: 'contain',
                                                    display: 'block'
                                                }}
                                            />
                                        </div>
                                        <p style={{ margin: '0', fontSize: '9px', fontWeight: 'bold', color: '#333' }}>HARDIK CHHATRI</p>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '8px', color: '#666' }}>8435299993@hdfc</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview Footer (shown only in preview, not in PDF - PDF uses jsPDF footer) */}
                    <div style={{
                        width: '210mm',
                        margin: '0 auto',
                        backgroundColor: '#d9d0c3',
                        padding: '25px 40px',
                        textAlign: 'center',
                        boxSizing: 'border-box'
                    }}>
                        <h2 style={{
                            color: '#5a5a5a',
                            fontSize: '26px',
                            fontWeight: 'normal',
                            margin: '0 0 5px 0',
                            fontFamily: 'Georgia, serif',
                            letterSpacing: '2px'
                        }}>Thank you!</h2>
                        <p style={{ color: '#5a5a5a', fontSize: '9px', margin: 0, letterSpacing: '1px' }}>Powered By Botovate</p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default QuotationPDF;

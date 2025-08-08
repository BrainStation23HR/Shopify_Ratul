import React from 'react';
import { Page, Layout } from '@shopify/polaris';

const PageLoader = () => {
    return (
        <Page>
            <Layout>
                <div style={{display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    width: "100vw",
                    color: '#ff4d00',
                }}>
                    <svg width="250" height="250" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="40" cy="40" r="4" fill="currentColor">
                            <animate attributeName="r" values="2;0" dur="1.5s" begin="0s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="40" cy="40" r="0" stroke="currentColor" strokeWidth="1">
                            <animate attributeName="r" values="0;36" dur="1.5s" begin="0s" repeatCount="indefinite"/>
                            <animate attributeName="opacity" values="1;0" dur="1.5s" begin="0s" repeatCount="indefinite"/>
                        </circle>
                        <circle cx="40" cy="40" r="0" stroke="currentColor" strokeWidth="1">
                            <animate attributeName="r" values="0;36" dur="1.5s" begin=".75s" repeatCount="indefinite"/>
                            <animate attributeName="opacity" values="1;0" dur="1.5s" begin="1s" repeatCount="indefinite"/>
                        </circle>
                    </svg>
                </div>
            </Layout>
        </Page>
    );
};

export default PageLoader;

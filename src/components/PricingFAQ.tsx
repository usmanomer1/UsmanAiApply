import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Zap, Bot, Brain, CreditCard, Shield, RefreshCw } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string | React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}

const faqData: FAQItem[] = [
  {
    question: "How does the application limit work?",
    answer: (
      <div className="space-y-2">
        <p>Each plan includes automated job applications per month:</p>
        <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
          <li><strong>Plus:</strong> 37 applications/month</li>
          <li><strong>Pro:</strong> 77 applications/month</li>
          <li><strong>Max:</strong> 158 applications/month</li>
        </ul>
        <p className="text-sm pt-2">Need more? Additional applications are just $0.80 each - no commitment required.</p>
      </div>
    ),
    icon: Bot
  },
  {
    question: "What are AI tokens and how do they work?",
    answer: (
      <div className="space-y-2">
        <p>AI tokens power your resume optimization and cover letter generation:</p>
        <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
          <li>All plans include <strong>30,000 AI tokens/month</strong></li>
          <li>Basic requests: ~500-1,000 tokens</li>
          <li>Complex requests: 2x token cost</li>
          <li>Overage: $0.10 per 1,000 tokens</li>
        </ul>
        <p className="text-sm pt-2">Most users never exceed their monthly allowance.</p>
      </div>
    ),
    icon: Brain
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer: (
      <div className="space-y-2">
        <p><strong>Upgrades:</strong> Instant activation with prorated billing</p>
        <p><strong>Downgrades:</strong> Take effect at your next billing cycle - you keep full access until then</p>
        <p className="text-sm pt-2">Change plans anytime through your billing dashboard. No contracts, no hassle.</p>
      </div>
    ),
    icon: RefreshCw
  },
  {
    question: "What's included in all plans?",
    answer: (
      <div className="space-y-2">
        <p>Every plan includes these core features:</p>
        <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
          <li>AI-powered resume optimization</li>
          <li>Custom cover letter generation</li>
          <li>Voice AI features for interview prep</li>
          <li>LinkedIn automation tools</li>
          <li>Real-time application tracking</li>
          <li>Browser automation ($0.03/step + $0.01 init)</li>
        </ul>
      </div>
    ),
    icon: Zap
  },
  {
    question: "How does browser automation pricing work?",
    answer: (
      <div className="space-y-2">
        <p>Our browser automation runs on a simple, transparent model:</p>
        <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
          <li><strong>$0.01</strong> initialization fee per session</li>
          <li><strong>$0.03</strong> per automation step</li>
          <li>Average job application: ~10-15 steps ($0.31-$0.46 total)</li>
        </ul>
        <p className="text-sm pt-2">Only pay for what you use. No minimum usage requirements.</p>
      </div>
    ),
    icon: Bot
  },
  {
    question: "Do you offer refunds?",
    answer: (
      <div className="space-y-2">
        <p>We offer a <strong>7-day money-back guarantee</strong> for all new subscriptions.</p>
        <p>Not satisfied? Contact us within 7 days for a full refund, no questions asked.</p>
        <p className="text-sm pt-2">Usage-based charges (browser automation, token overages) are non-refundable but very affordable.</p>
      </div>
    ),
    icon: Shield
  },
  {
    question: "Can I buy token packs instead of subscribing?",
    answer: (
      <div className="space-y-2">
        <p>Absolutely! We offer flexible token packs for both job applications and AI usage:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div>
            <p className="font-medium text-sm">Job Application Packs:</p>
            <ul className="list-disc list-inside space-y-1 text-xs opacity-90">
              <li>QuickApply: $7 (10 apps)</li>
              <li>Hustle Boost: $17 (25 apps)</li>
              <li>Full Send: $60 (100 apps)</li>
              <li>Career Storm: $145 (250 apps)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-sm">AI Token Packs:</p>
            <ul className="list-disc list-inside space-y-1 text-xs opacity-90">
              <li>Light Boost: $1 (10K tokens)</li>
              <li>Smart Stack: $2 (25K tokens)</li>
              <li>Power Draft: $3 (50K tokens)</li>
              <li>Creator Surge: $5 (100K tokens)</li>
              <li>AI Vault: $10 (250K tokens)</li>
            </ul>
          </div>
        </div>
        <p className="text-sm pt-2">Perfect for testing or occasional use. Tokens never expire.</p>
      </div>
    ),
    icon: CreditCard
  },
  {
    question: "Is my data secure?",
    answer: (
      <div className="space-y-2">
        <p>Your privacy and security are our top priorities:</p>
        <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
          <li>All data encrypted in transit and at rest</li>
          <li>SOC 2 compliant infrastructure</li>
          <li>No data sharing with third parties</li>
          <li>You can export or delete your data anytime</li>
        </ul>
        <p className="text-sm pt-2">We're GDPR compliant and take data protection seriously.</p>
      </div>
    ),
    icon: Shield
  }
];

export const PricingFAQ: React.FC = () => {
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index);
    } else {
      newOpenItems.add(index);
    }
    setOpenItems(newOpenItems);
  };

  return (
    <div className="max-w-4xl mx-auto mt-16 mb-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Everything you need to know about our pricing and features
        </p>
      </div>

      <div className="space-y-4">
        {faqData.map((item, index) => {
          const isOpen = openItems.has(index);
          const Icon = item.icon;

          return (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <button
                onClick={() => toggleItem(index)}
                className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 rounded-xl transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {item.question}
                  </h3>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-6 pb-5">
                  <div className="pl-9 text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.answer}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact CTA */}
      <div className="mt-12 text-center">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-8">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Still have questions?
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Our team is here to help you succeed in your job search
          </p>
          <a
            href="mailto:usman@jobotic.ai"
            className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}; 
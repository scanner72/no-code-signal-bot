import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SettingsService } from '../settings/settings.service';
import axios from 'axios';

export interface SentimentData {
    score: number; // -1 to 1
    label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    source: string;
    lastUpdated: Date;
    topNews: { title: string; sentiment: number }[];
}

@Injectable()
export class SentimentService {
    private readonly logger = new Logger(SentimentService.name);
    private currentSentiment: SentimentData = {
        score: 0.15,
        label: 'NEUTRAL',
        source: 'Aggregated Simulation',
        lastUpdated: new Date(),
        topNews: [
            { title: 'Market awaits CPI data', sentiment: 0 },
            { title: 'Bitcoin ETFs see steady inflows', sentiment: 0.4 }
        ]
    };

    private readonly cryptoNewsPool = [
        { title: 'Bitcoin network hash rate hits new all-time high', sentiment: 0.5 },
        { title: 'Major exchange faces regulatory scrutiny in Europe', sentiment: -0.6 },
        { title: 'New layer 2 solution gains massive traction', sentiment: 0.4 },
        { title: 'Whale transfers $500M BTC to cold storage', sentiment: 0.3 },
        { title: 'Tech giant announces crypto payment integration', sentiment: 0.7 },
        { title: 'Global inflation data higher than expected', sentiment: -0.4 },
        { title: 'Institutional interest in ETH growing rapidly', sentiment: 0.5 },
        { title: 'Popular DeFi protocol exploited for $20M', sentiment: -0.8 }
    ];

    constructor(
        private readonly settingsService: SettingsService
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async updateSentiment() {
        try {
            const apiKey = await this.settingsService.get('cryptopanic_api_key');
            
            if (apiKey && apiKey.trim().length > 0) {
                await this.fetchFromCryptoPanic(apiKey.trim());
            } else {
                this.runSimulation('No CryptoPanic API key configured. Using simulation.');
            }
        } catch (err: any) {
            this.logger.warn(`Failed to update real sentiment, falling back to simulation: ${err.message}`);
            this.runSimulation('Error fetching real news. Using simulation.');
        }
    }

    private async fetchFromCryptoPanic(apiKey: string) {
        try {
            const response = await axios.get(`https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&public=true`, {
                timeout: 8000
            });

            if (response.data && Array.isArray(response.data.results)) {
                const posts = response.data.results.slice(0, 10); // Take top 10 recent posts
                if (posts.length === 0) {
                    this.runSimulation('CryptoPanic returned empty results. Using simulation.');
                    return;
                }

                const newsItems = posts.map((post: any) => {
                    const title = post.title || 'Crypto News';
                    let sentimentVal = 0;

                    const posVotes = Number(post.votes?.positive || 0);
                    const negVotes = Number(post.votes?.negative || 0);

                    if (posVotes + negVotes > 0) {
                        // Calculate based on votes
                        sentimentVal = (posVotes - negVotes) / (posVotes + negVotes);
                    } else {
                        // Fallback to keyword analyzer
                        const titleLower = title.toLowerCase();
                        const bullishWords = ['bullish', 'positive', 'rally', 'surge', 'growth', 'gain', 'buy', 'upgrade', 'inflow'];
                        const bearishWords = ['bearish', 'negative', 'decline', 'crash', 'hack', 'exploit', 'lawsuit', 'ban', 'sell', 'outflow', 'scrutiny'];
                        
                        bullishWords.forEach(w => { if (titleLower.includes(w)) sentimentVal += 0.35; });
                        bearishWords.forEach(w => { if (titleLower.includes(w)) sentimentVal -= 0.35; });
                        sentimentVal = Math.max(-1.0, Math.min(1.0, sentimentVal));
                    }

                    return {
                        title,
                        sentiment: parseFloat(sentimentVal.toFixed(2))
                    };
                });

                const totalSentiment = newsItems.reduce((acc: number, item: any) => acc + item.sentiment, 0);
                const avgScore = parseFloat((totalSentiment / newsItems.length).toFixed(2));

                let label: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
                if (avgScore > 0.2) label = 'BULLISH';
                if (avgScore < -0.2) label = 'BEARISH';

                this.currentSentiment = {
                    score: avgScore,
                    label,
                    source: 'CryptoPanic API',
                    lastUpdated: new Date(),
                    topNews: newsItems.slice(0, 3) // Store top 3 news for summary
                };

                this.logger.debug(`CryptoPanic Sentiment updated: ${avgScore} (${label})`);
            } else {
                throw new Error('Invalid response structure from CryptoPanic');
            }
        } catch (e: any) {
            this.logger.warn(`CryptoPanic API call failed: ${e.message}`);
            this.runSimulation('CryptoPanic API error. Using simulation.');
        }
    }

    private runSimulation(reason: string) {
        // Pick 2-3 random news items from simulation pool
        const news = this.cryptoNewsPool
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);
        
        const avgNewsSentiment = news.reduce((acc, n) => acc + n.sentiment, 0) / news.length;
        
        // Combine current score with news (70% current, 30% news) + small noise
        let newScore = (this.currentSentiment.score * 0.7) + (avgNewsSentiment * 0.3) + (Math.random() - 0.5) * 0.05;
        newScore = Math.max(-1, Math.min(1, newScore));

        let label: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
        if (newScore > 0.3) label = 'BULLISH';
        if (newScore < -0.3) label = 'BEARISH';

        this.currentSentiment = {
            score: parseFloat(newScore.toFixed(2)),
            label,
            source: 'Aggregated Simulation',
            topNews: news,
            lastUpdated: new Date()
        };

        this.logger.debug(`Sentiment updated (Simulation, reason: ${reason}): ${newScore} (${label})`);
    }

    getSentiment() {
        return this.currentSentiment;
    }
}


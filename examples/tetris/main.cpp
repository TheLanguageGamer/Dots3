// /path/to/emcc main.cpp -std=c++11 -O2 -I../../ -s USE_SDL=1 -s WASM=0 -s --js-library ../../library_engine.js -s ASSERTIONS=2 -o main.js

#include <random>
#include "Engine.h"

std::random_device rd;
std::mt19937 rng(rd()); 

enum TS
{
	TS_Empty = 0,
	TS_Falling = 1,
	TS_Grounded = 2,
};

struct TetrisConfiguration
{
	enum Mode
	{
		Regular = 0,
		RotatingGround,
		Invisible,
	};
	std::vector<std::vector<std::vector<uint32_t>>> shapes;
	Vector2Int boardSize;
	Vector2Int activeColumnSpan;
	Mode mode;
	bool visible;
};

std::vector<std::vector<std::vector<uint32_t>>> getTetrominoes()
{
	return std::vector<std::vector<std::vector<uint32_t>>>({
		{
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
	});
}

std::vector<std::vector<std::vector<uint32_t>>> getTttetrominoes()
{
	return std::vector<std::vector<std::vector<uint32_t>>>({
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Falling},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
	});
}

std::vector<std::vector<std::vector<uint32_t>>> getPentominoes()
{
	return std::vector<std::vector<std::vector<uint32_t>>>({
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Falling, TS_Falling, TS_Empty},
			{TS_Empty, TS_Falling, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
		{
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Falling, TS_Falling, TS_Falling, TS_Falling, TS_Falling},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
			{TS_Empty, TS_Empty, TS_Empty, TS_Empty, TS_Empty},
		},
	});
}

TetrisConfiguration getVanillaTetris()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Regular;
	configuration.boardSize = Vector2Int(10, 24);
	configuration.activeColumnSpan = Vector2Int(0, 9);
	configuration.shapes = getTetrominoes();
	configuration.visible = false;
	return configuration;
}

TetrisConfiguration getTttetris()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Regular;
	configuration.visible = false;
	configuration.boardSize = Vector2Int(15, 24);
	configuration.activeColumnSpan = Vector2Int(0, 9);
	configuration.shapes = getTttetrominoes();
	return configuration;
}

TetrisConfiguration getPentris()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::Regular;
	configuration.visible = false;
	configuration.boardSize = Vector2Int(13, 24);
	configuration.activeColumnSpan = Vector2Int(0, 12);
	configuration.shapes = getPentominoes();
	return configuration;
}

TetrisConfiguration getSirTet()
{
	TetrisConfiguration configuration;
	configuration.mode = TetrisConfiguration::RotatingGround;
	configuration.visible = false;
	configuration.boardSize = Vector2Int(20, 24);
	configuration.activeColumnSpan = Vector2Int(5, 14);
	configuration.shapes = getTetrominoes();
	return configuration;
}

std::vector<uint32_t> colors({
	0xe6194B00,
	0x3cb44b00,
	0xffe11900,
	0x4363d800,
	0xf5823100,
	0x911eb400,
	0x42d4f400,
	0xf032e600,
	0xbfef4500,
	0xfabebe00,
	0x46999000,
	0xe6beff00,
	0x9A632400,
	0xfffac800,
	0x80000000,
	0xaaffc300,
	0x80800000,
	0xffd8b100,
	0x00007500,
});

struct PlayTetris : Screen
{
	double period;
	double lastDrop;
	double currentTime;
	std::shared_ptr<EntityGrid> entityGrid;

	uint32_t level;
	uint32_t lines;
	uint32_t score;

	std::shared_ptr<struct TextComponent> levelValue;
	std::shared_ptr<struct TextComponent> linesValue;
	std::shared_ptr<struct TextComponent> scoreValue;

	TetrisConfiguration configuration;
	Vector2Int activeColumnSpan;
	BoxInt gridBox;

	std::uniform_int_distribution<uint32_t> shapePrDist;
	std::uniform_int_distribution<uint32_t> rotationPrDist;

	PlayTetris(TetrisConfiguration configuration)
	: configuration(configuration)
	, activeColumnSpan(configuration.activeColumnSpan)
	, period(200.0)
	, lastDrop(0.0)
	, currentTime(0.0)
	, shapePrDist(0, configuration.shapes.size()-1)
	, rotationPrDist(0, 3)
	, level(1)
	, lines(0)
	, score(0)
	, gridBox(Vector2Int(), configuration.boardSize)
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xFF88AAFF));

		setupShapes();

		entityGrid = std::shared_ptr<EntityGrid>(new EntityGrid(
			entities,
			configuration.boardSize,
			[](){
				return Entity::roundedRectangle(
					Vector2(),
					Vector2(),
					3.0f,
					1.0f,
					0xFFFFFFFF,
					0x000000FF
				);
			},
			[](std::vector<Entity>& entities, uint32_t index, uint32_t state) {
				uint32_t alpha = Entity::getFillAlpha(entities[index]);
				uint32_t color = (state & 0xFFFFFF00) | alpha;
				//printf("setting cell: %08x, %08x, %08x\n", alpha, state, color);
				Entity::setFillColor(entities[index], color);
			}
		));
		entityGrid->sizeMode = Component::SizeMode_FixedAspectRatio;
		entityGrid->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		entityGrid->setOffsetSize(entities, Vector2(-10.0f, -10.0f));
		entityGrid->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		entityGrid->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		//entityGrid->setCell(entities, 0, 0, 1);

		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		rootComponent->addChild(entities, entityGrid);

		auto textContainer = std::shared_ptr<struct Component>(new struct Component(entities));
		textContainer->setRelativePosition(entities, Vector2(0.0f, 0.0f));
		textContainer->setOffsetPosition(entities, Vector2(-10.0f, 50.0f));
		textContainer->positionMode = Component::PositionMode_VerticalBlock;
		entityGrid->addChild(entities, textContainer);

		auto levelLabel = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "LEVEL", 0xAAAAAAFF, 30.0f));
		levelLabel->sizeMode = Component::SizeMode_SizeToContents;
		levelLabel->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, levelLabel);

		levelValue = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "1", 0xFFFFFFFF, 30.0f));
		levelValue->sizeMode = Component::SizeMode_SizeToContents;
		levelValue->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, levelValue);

		auto linesLabel = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "LINES", 0xAAAAAAFF, 30.0f));
		linesLabel->sizeMode = Component::SizeMode_SizeToContents;
		linesLabel->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, linesLabel);

		linesValue = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "0", 0xFFFFFFFF, 30.0f));
		linesValue->sizeMode = Component::SizeMode_SizeToContents;
		linesValue->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, linesValue);

		auto scoreLabel = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "SCORE", 0xAAAAAAFF, 30.0f));
		scoreLabel->sizeMode = Component::SizeMode_SizeToContents;
		scoreLabel->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, scoreLabel);

		scoreValue = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "0", 0xFFFFFFFF, 30.0f));
		scoreValue->sizeMode = Component::SizeMode_SizeToContents;
		scoreValue->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, scoreValue);

		stampRandomShape();
		updateProgress(0);

		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{			
			while (entityGrid->canMoveDown(entities, TS_Falling, 0xFF))
			{
				moveDown(TS_Falling, gridBox);
			}
			ground();
			stampRandomShape();
			// entityGrid->setCell(entities, 20, 5, 0xFF88AA00|TS_Grounded);
			// entityGrid->setCell(entities, 20, 6, 0xAA88FF00|TS_Grounded);
		}

		// entityGrid->setCell(entities, 15, 0, 0xFF88AA00|TS_Grounded);
		// entityGrid->setCell(entities, 15, 1, 0xFF88AA00|TS_Grounded);
		// entityGrid->setCell(entities, 15, 2, 0xFF88AA00|TS_Grounded);
		// entityGrid->setCell(entities, 15, 3, 0xFF88AA00|TS_Grounded);
		// entityGrid->setCell(entities, 15, 4, 0xFF88AA00|TS_Grounded);
	}

	void reset()
	{
		lines = 0;
		score = 0;
		updateProgress(0);
		for (int32_t row = 0; row < entityGrid->matrixSize.y; ++row)
		{
			for (int32_t column = 0; column < entityGrid->matrixSize.x; ++column)
			{
				entityGrid->setCell(entities, row, column, TS_Empty);
			}
		}
		stampRandomShape();

		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{			
			while (entityGrid->canMoveDown(entities, TS_Falling, 0xFF))
			{
				moveDown(TS_Falling, gridBox);
			}
			ground();
			stampRandomShape();
		}
	}

	void setupShapes()
	{
		auto& shapes = configuration.shapes;
		uint32_t colorIndex = 0;
		for (int32_t i = 0; i < shapes.size(); i++)
		{
			for (int32_t j = 0; j < shapes[i].size(); j++)
			{
				for (int32_t k = 0; k < shapes[j].size(); k++)
				{
					uint32_t state = shapes[i][j][k];
					if (state == TS_Empty)
					{
						continue;
					}
					shapes[i][j][k] = colors[colorIndex] | state;
				}
			}
			colorIndex += 1;
			colorIndex %= colors.size();
		}
	}

	void stampRandomShape()
	{
		//static uint32_t index = 0;
		//index %= configuration.shapes.size();
		Vector2Int currentOffset = Vector2Int(entityGrid->matrixSize.x/2-2, 0);
		auto shape = configuration.shapes[shapePrDist(rng)];
		//printf("jhelms stamping %u, %lu, %lu\n", index, configuration.shapes.size(), sizeof(configuration.shapes[index]));
		//auto shape = configuration.shapes[index];
		entityGrid->stamp(entities, shape, currentOffset);

		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{
			uint32_t count = rotationPrDist(rng);
			for (uint32_t i = 0; i < count; ++i)
			{
				uint32_t rotatingState = TS_Falling;
				BoxInt box = entityGrid->getBoundingSquare(entities, rotatingState, 0xFF);
				if (entityGrid->canRotate(entities, box.position, box.size.x, rotatingState, 0xFF))
				{
					entityGrid->rotate(entities, box.position, box.size.x, rotatingState, 0xFF);
					clearRows();
				}
			}
		}
	}

	void updateProgress(uint32_t rowsCleared)
	{
		lines += rowsCleared;
		level = lines/10 + 1;
		if (rowsCleared == 1)
		{
			score += 100;
		}
		else if (rowsCleared == 2)
		{
			score += 300;
		}
		else if (rowsCleared == 3)
		{
			score += 500;
		}
		else if (rowsCleared == 4)
		{
			score += 800;
		}
		else if (rowsCleared == 5)
		{
			score += 1100;
		}
		else if (rowsCleared == 6)
		{
			score += 1500;
		}

		period = 700.0/(1.0 + 2.0/3.0*((float)level-1.0));

		levelValue->setText(entities, std::to_string(level));
		linesValue->setText(entities, std::to_string(lines));
		scoreValue->setText(entities, std::to_string(score));
	}

	void clearRows()
	{
		uint32_t rowsCleared = 0;
		for (int32_t row = entityGrid->matrixSize.y-1; row >= 0; --row)
		{
			bool isFilled = true;
			for (int32_t column = activeColumnSpan.x; column <= activeColumnSpan.y; ++column)
			{
				uint32_t masked = entityGrid->getCell(entities, row, column)&0xFF;
				isFilled = isFilled && masked == TS_Grounded;
			}
			if (isFilled)
			{
				rowsCleared += 1;
				for (int32_t column = activeColumnSpan.x; column <= activeColumnSpan.y; ++column)
				{
					entityGrid->setCell(entities, row, column, TS_Empty);
				}
				BoxInt box(Vector2Int(), Vector2Int(entityGrid->matrixSize.x, row + 1));
				moveDown(TS_Grounded, box);
				row += 1;
			}
		}
		updateProgress(rowsCleared);
	}

	void ground()
	{
		for (int32_t row = entityGrid->matrixSize.y-1; row >= 0; --row)
		{
			for (int32_t column = 0; column < entityGrid->matrixSize.x; ++column)
			{
				uint32_t currentState = entityGrid->getCell(entities, row, column);
				uint32_t newMasked = (currentState&0xFF) != TS_Empty ? TS_Grounded : TS_Empty;
				uint32_t newState = newMasked|(currentState&0xFFFFFF00);
				entityGrid->setCell(entities, row, column, newState);
			}
		}
		clearRows();
	}

	void moveDown(uint32_t activeState, const BoxInt& box)
	{
		entityGrid->moveDown(entities, activeState, box);
	}

	void moveLeft(uint32_t activeState)
	{
		entityGrid->moveLeft(entities, activeState, gridBox);
		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{
			activeColumnSpan.x -= 1;
			activeColumnSpan.y -= 1;
		}
	}

	void moveRight(uint32_t activeState)
	{
		entityGrid->moveRight(entities, activeState, gridBox);
		if (configuration.mode == TetrisConfiguration::RotatingGround)
		{
			activeColumnSpan.x += 1;
			activeColumnSpan.y += 1;
		}
	}

	void loop(float delta, const std::vector<bool>& keyStates) override
	{
		bool dead = false;
		uint32_t activeState = configuration.mode == TetrisConfiguration::RotatingGround ? TS_Grounded : TS_Falling;
		float effectivePeriod = (keyStates[SDLK_DOWN] || keyStates[SDLK_s]) ? period / 10.0 : period;
		currentTime += delta;
		if (currentTime - lastDrop > effectivePeriod)
		{
			if (!entityGrid->canMoveDown(entities, TS_Falling, 0xFF))
			{
				ground();
				stampRandomShape();
			}
			else
			{
				//printf("jhelms will moveDown\n");
				bool couldMoveLeft = entityGrid->canMoveLeft(entities, activeState, 0xFF);
				bool couldMoveRight = entityGrid->canMoveRight(entities, activeState, 0xFF);
				moveDown(TS_Falling, gridBox);
				if (keyStates[SDLK_LEFT] && entityGrid->canMoveLeft(entities, activeState, 0xFF) && !couldMoveLeft)
				{
					moveLeft(activeState);
				}
				if (keyStates[SDLK_RIGHT] && entityGrid->canMoveRight(entities, activeState, 0xFF) && !couldMoveRight)
				{
					moveRight(activeState);
				}
			}
			lastDrop = currentTime;
		}
	}

	void onKeyDown(SDL_Keycode key) override
	{
		uint32_t activeState = configuration.mode == TetrisConfiguration::RotatingGround ? TS_Grounded : TS_Falling;
		switch (key)
		{
			case SDLK_SPACE:
			{
				while (entityGrid->canMoveDown(entities, TS_Falling, 0xFF))
				{
					moveDown(TS_Falling, gridBox);
				}
				break;
			}
			case SDLK_LEFT:
			case SDLK_a:
			{
				printf("jhelms SDLK_LEFT\n");
				if (entityGrid->canMoveLeft(entities, activeState, 0xFF))
				{
					printf("jhelms canMoveLeft\n");
					moveLeft(activeState);
				}
				break;
			}
			case SDLK_RIGHT:
			case SDLK_d:
			{
				if (entityGrid->canMoveRight(entities, activeState, 0xFF))
				{
					moveRight(activeState);
				}
				break;
			}
			case SDLK_UP:
			case SDLK_w:
			{
				uint32_t rotatingState = configuration.mode == TetrisConfiguration::RotatingGround ? TS_Grounded : TS_Falling;
				BoxInt box = entityGrid->getBoundingSquare(entities, rotatingState, 0xFF);
				if (entityGrid->canRotate(entities, box.position, box.size.x, rotatingState, 0xFF))
				{
					entityGrid->rotate(entities, box.position, box.size.x, rotatingState, 0xFF);
					if (configuration.mode == TetrisConfiguration::RotatingGround)
					{
						int32_t activeColumnCenter = activeColumnSpan.x + (activeColumnSpan.y - activeColumnSpan.x + 1)/2;
						int32_t rotatedCenter = box.position.x + box.size.x / 2;
						int32_t delta = rotatedCenter - activeColumnCenter;
						activeColumnSpan.x += delta;
						activeColumnSpan.y += delta;
					}
					clearRows();
				}
				break;
			}
			default:
			{
				break;
			}
		}
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game;
	std::shared_ptr<Screen> vanilla = std::shared_ptr<Screen>(new PlayTetris(getVanillaTetris()));
	std::shared_ptr<Screen> pentris = std::shared_ptr<Screen>(new PlayTetris(getPentris()));
	std::shared_ptr<Screen> tttetris = std::shared_ptr<Screen>(new PlayTetris(getTttetris()));
	std::shared_ptr<Screen> sirtet = std::shared_ptr<Screen>(new PlayTetris(getSirTet()));
	game.setScreen(vanilla);

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(vanilla);
					break;
				}
				case 1:
				{
					game.setScreen(tttetris);
					break;
				}
				case 2:
				{
					game.setScreen(pentris);
					break;
				}
				case 3:
				{
					game.setScreen(sirtet);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}
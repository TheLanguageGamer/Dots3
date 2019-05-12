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
	std::vector<std::vector<uint32_t>> currentShape;
	Vector2Int currentOffset;
	Vector2Int activeColumnSpan;

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
	, currentOffset(0, 0)
	, level(1)
	, lines(0)
	, score(0)
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
		levelLabel->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, levelLabel);

		levelValue = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "1", 0xFFFFFFFF, 30.0f));
		levelValue->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, levelValue);

		auto linesLabel = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "LINES", 0xAAAAAAFF, 30.0f));
		linesLabel->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, linesLabel);

		linesValue = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "0", 0xFFFFFFFF, 30.0f));
		linesValue->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, linesValue);

		auto scoreLabel = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "SCORE", 0xAAAAAAFF, 30.0f));
		scoreLabel->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, scoreLabel);

		scoreValue = std::shared_ptr<struct TextComponent>(
			new TextComponent(entities, "0", 0xFFFFFFFF, 30.0f));
		scoreValue->setAnchorPoint(entities, Vector2(1.0f, 0.0f));
		textContainer->addChild(entities, scoreValue);

		stampRandomShape();
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
		static uint32_t index = 0;
		index %= configuration.shapes.size();
		currentOffset = Vector2Int(entityGrid->matrixSize.x/2-2, 0);
		//auto shape = configuration.shapes[shapePrDist(rng)];
		printf("jhelms stamping %u, %lu, %lu\n", index, configuration.shapes.size(), sizeof(configuration.shapes[index]));
		auto shape = configuration.shapes[index];
		printf("jhelms have shape\n");
		entityGrid->stamp(entities, shape, currentOffset);
		currentShape = shape;
		index += 1;
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
				moveDown(row, TS_Grounded);
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

	bool canMoveDown()
	{
		for (int32_t row = entityGrid->matrixSize.y-1; row >= 0; --row)
		{
			for(int32_t column = 0; column < entityGrid->matrixSize.x; ++column)
			{
				uint32_t aboveMasked = row > 0 ? entityGrid->getCell(entities, row-1, column)&0xFF : TS_Empty;
				uint32_t currentMasked = entityGrid->getCell(entities, row, column)&0xFF;
				if ((aboveMasked == TS_Falling && currentMasked == TS_Grounded)
					|| (row == entityGrid->matrixSize.y-1 && currentMasked == TS_Falling))
				{
					return false;
				}
			}
		}
		return true;
	}

	bool canMoveLeft(uint32_t activeState)
	{
		for(int32_t column = 0; column < entityGrid->matrixSize.x; ++column)
		{
			for (int32_t row = entityGrid->matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentMasked = entityGrid->getCell(entities, row, column)&0xFF;
				uint32_t newMasked = column < entityGrid->matrixSize.x-1 ? entityGrid->getCell(entities, row, column+1)&0xFF : TS_Empty;
				if ((newMasked == activeState && currentMasked != activeState && currentMasked != TS_Empty)
					|| (column == 0 && currentMasked == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}

	bool canMoveRight(uint32_t activeState)
	{
		for(int32_t column = entityGrid->matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = entityGrid->matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentMasked = entityGrid->getCell(entities, row, column)&0xFF;
				uint32_t newMasked = column > 0 ? entityGrid->getCell(entities, row, column-1)&0xFF : TS_Empty;
				if ((newMasked == activeState && currentMasked != activeState && currentMasked != TS_Empty)
					|| (column == entityGrid->matrixSize.x-1 && currentMasked == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}

	void moveDown(int32_t fromRow = -1, uint32_t movingState = TS_Falling)
	{
		fromRow = fromRow < 0 ? entityGrid->matrixSize.y-1 : fromRow;
		for (int32_t row = fromRow; row >= 0; --row)
		{
			for(int32_t column = 0; column < entityGrid->matrixSize.x; ++column)
			{
				uint32_t currentState = entityGrid->getCell(entities, row, column);
				uint32_t newState = row > 0 ? entityGrid->getCell(entities, row-1, column) : TS_Empty;
				uint32_t currentMasked = currentState&0xFF;
				uint32_t newMasked = newState&0xFF;
				if (currentMasked == movingState && newMasked != movingState)
				{
					newState = TS_Empty;
				}
				if ((currentMasked == movingState && newMasked == TS_Empty)
					|| (currentMasked == TS_Empty && newMasked == movingState))
				{
					entityGrid->setCell(entities, row, column, newState);
				}
			}
		}
		currentOffset.y += 1;
	}

	void moveLeft(uint32_t activeState)
	{
		for(int32_t column = 0; column < entityGrid->matrixSize.x; ++column)
		{
			for (int32_t row = entityGrid->matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = entityGrid->getCell(entities, row, column);
				uint32_t newState = column < entityGrid->matrixSize.x-1 ? entityGrid->getCell(entities, row, column+1) : TS_Empty;
				uint32_t currentMasked = currentState&0xFF;
				uint32_t newMasked = newState&0xFF;
				if (currentMasked == activeState && newMasked != activeState && newMasked != TS_Empty)
				{
					newState = TS_Empty;
				}
				if ((currentMasked == activeState && newMasked == TS_Empty)
					|| (currentMasked == TS_Empty && newMasked == activeState))
				{
					entityGrid->setCell(entities, row, column, newState);
				}
			}
		}
		currentOffset.x -= 1;
	}

	void moveRight(uint32_t activeState)
	{
		for(int32_t column = entityGrid->matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = entityGrid->matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = entityGrid->getCell(entities, row, column);
				uint32_t newState = column > 0 ? entityGrid->getCell(entities, row, column-1) : TS_Empty;
				uint32_t currentMasked = currentState&0xFF;
				uint32_t newMasked = newState&0xFF;
				if (currentMasked == activeState && newMasked != activeState && newMasked != TS_Empty)
				{
					newState = TS_Empty;
				}
				if ((currentMasked == activeState && newMasked == TS_Empty)
					|| (currentMasked == TS_Empty && newMasked == activeState))
				{
					entityGrid->setCell(entities, row, column, newState);
				}
			}
		}
		currentOffset.x += 1;
	}

	bool canSwap(const Vector2Int a, Vector2Int b, uint32_t activeState)
	{
		bool aInBounds = entityGrid->isValidCoordinate(a);
		bool bInBounds = entityGrid->isValidCoordinate(b);
		if (!aInBounds && !bInBounds)
		{
			return true;
		}
		if (aInBounds && !bInBounds)
		{
			uint32_t maskedA = entityGrid->getCell(entities, a.y, a.x)&0xFF;
			return maskedA != activeState;
		}
		if (bInBounds && !aInBounds)
		{
			uint32_t maskedB = entityGrid->getCell(entities, b.y, b.x)&0xFF;
			return maskedB != activeState;
		}
		uint32_t maskedA = entityGrid->getCell(entities, a.y, a.x);
		uint32_t maskedB = entityGrid->getCell(entities, b.y, b.x);
		return !((maskedA == activeState && (maskedB != activeState && maskedB != TS_Empty))
				|| (maskedB == activeState && (maskedA != activeState && maskedA != TS_Empty)));
	}

	void setCellAux(Vector2Int coord, int64_t newState, uint32_t activeState)
	{
		if (newState < 0)
		{
			return;
		}
		if (!entityGrid->isValidCoordinate(coord))
		{
			return;
		}
		uint32_t newMasked = newState&0xFF;
		uint32_t state = entityGrid->getCell(entities, coord.y, coord.x);
		uint32_t masked = state&0xFF;
		if ((masked != activeState && masked != TS_Empty) || (newMasked != activeState && newMasked != TS_Empty))
		{
			return;
		}
		entityGrid->setCell(entities, coord.y, coord.x, newState);
	}

	void rotate(const Vector2Int& offset, uint32_t shapeWidth, uint32_t activeState)
	{
		for(int32_t x = 0; x < shapeWidth/2; ++x)
		{
			for (int32_t y = x; y < shapeWidth-x-1; ++y)
			{
				Vector2Int coord1(offset.x + x, offset.y + y);
				Vector2Int coord2(offset.x + y, offset.y + shapeWidth - 1 - x);
				Vector2Int coord3(offset.x + shapeWidth - 1 - x, offset.y + shapeWidth - 1 - y);
				Vector2Int coord4(offset.x + shapeWidth - 1 - y, offset.y + x);

				int64_t state1 = entityGrid->isValidCoordinate(coord1) ?  entityGrid->getCell(entities, coord1.y, coord1.x) : TS_Empty;
				int64_t state2 = entityGrid->isValidCoordinate(coord2) ?  entityGrid->getCell(entities, coord2.y, coord2.x) : TS_Empty;
				int64_t state3 = entityGrid->isValidCoordinate(coord3) ?  entityGrid->getCell(entities, coord3.y, coord3.x) : TS_Empty;
				int64_t state4 = entityGrid->isValidCoordinate(coord4) ?  entityGrid->getCell(entities, coord4.y, coord4.x) : TS_Empty;

				setCellAux(coord1, state2, activeState);
				setCellAux(coord2, state3, activeState);
				setCellAux(coord3, state4, activeState);
				setCellAux(coord4, state1, activeState);
			}
		}
	}

	bool canRotate(const Vector2Int& offset, uint32_t shapeWidth, uint32_t activeState)
	{
		if (offset.x < 0
			|| offset.x + shapeWidth > entityGrid->matrixSize.x
			|| offset.y < 0
			|| offset.y + shapeWidth > entityGrid->matrixSize.y)
		{
			printf("Can't rotate: %d %d %d %d\n", offset.x, offset.y, offset.x + shapeWidth, offset.y + shapeWidth);
			return false;
		}
		for(int32_t x = 0; x < shapeWidth; ++x)
		{
			for (int32_t y = x; y < shapeWidth-x-1; ++y)
			{
				Vector2Int coord1(offset.x + x, offset.y + y);
				Vector2Int coord2(offset.x + y, offset.y + shapeWidth - 1 - x);
				Vector2Int coord3(offset.x + shapeWidth - 1 - x, offset.y + shapeWidth - 1);
				Vector2Int coord4(offset.x + shapeWidth - 1 - y, offset.y + x);

				bool isFree = canSwap(coord1, coord2, activeState)
					&& canSwap(coord2, coord3, activeState)
					&& canSwap(coord3, coord4, activeState)
					&& canSwap(coord4, coord1, activeState);
				if (!isFree)
				{
					return false;
				}
			}
		}
		return true;
	}

	void loop(float delta, const std::vector<bool>& keyStates) override
	{
		bool dead = false;
		uint32_t activeState = configuration.mode == TetrisConfiguration::RotatingGround ? TS_Grounded : TS_Falling;
		float effectivePeriod = (keyStates[SDLK_DOWN] || keyStates[SDLK_s]) ? period / 10.0 : period;
		currentTime += delta;
		if (currentTime - lastDrop > effectivePeriod)
		{
			if (!canMoveDown())
			{
				ground();
				stampRandomShape();
			}
			else
			{
				printf("jhelms will moveDown\n");
				bool couldMoveLeft = canMoveLeft(activeState);
				bool couldMoveRight = canMoveRight(activeState);
				moveDown();
				if (keyStates[SDLK_LEFT] && canMoveLeft(activeState) && !couldMoveLeft)
				{
					moveLeft(activeState);
				}
				if (keyStates[SDLK_RIGHT] && canMoveRight(activeState) && !couldMoveRight)
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
				while (canMoveDown())
				{
					moveDown();
				}
				break;
			}
			case SDLK_LEFT:
			case SDLK_a:
			{
				printf("jhelms SDLK_LEFT\n");
				if (canMoveLeft(activeState))
				{
					printf("jhelms canMoveLeft\n");
					moveLeft(activeState);
				}
				break;
			}
			case SDLK_RIGHT:
			case SDLK_d:
			{
				if (canMoveRight(activeState))
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
				if (canRotate(box.position, box.size.x, rotatingState))
				{
					rotate(box.position, box.size.x, rotatingState);
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
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}